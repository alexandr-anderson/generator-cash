<?php
$root = dirname(__DIR__);
foreach (array($root . '/.env', $root . '/app/.env') as $file) {
  if (!is_file($file)) continue;
  foreach (file($file, FILE_IGNORE_NEW_LINES) as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === '#') continue;
    $eq = strpos($line, '=');
    if ($eq === false) continue;
    $key = trim(substr($line, 0, $eq));
    $value = trim(substr($line, $eq + 1));
    if ((strlen($value) >= 2) && (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'"))) {
      $value = substr($value, 1, -1);
    }
    if (!isset($_ENV[$key]) && getenv($key) === false) {
      putenv($key . '=' . $value);
      $_ENV[$key] = $value;
    }
  }
}

$url = getenv('DATABASE_URL');
if (!$url) {
  fwrite(STDERR, "==> apply-migrations: DATABASE_URL missing, skip\n");
  exit(0);
}
if (strpos($url, 'mysql://') !== 0 && strpos($url, 'mysqls://') !== 0) {
  fwrite(STDERR, "==> apply-migrations: not a MySQL URL, skip\n");
  exit(0);
}

$parsed = parse_url($url);
if ($parsed === false || empty($parsed['user']) || empty($parsed['path'])) {
  fwrite(STDERR, "==> apply-migrations: DATABASE_URL is not a valid URL\n");
  exit(1);
}

$user = rawurldecode($parsed['user']);
$pass = isset($parsed['pass']) ? rawurldecode($parsed['pass']) : '';
$host = isset($parsed['host']) ? $parsed['host'] : 'localhost';
$port = isset($parsed['port']) ? (string) $parsed['port'] : '3306';
$database = ltrim($parsed['path'], '/');
$migrationsDir = $root . '/prisma/migrations';
if (!is_dir($migrationsDir)) {
  fwrite(STDOUT, "==> apply-migrations: no prisma/migrations, skip\n");
  exit(0);
}

function mysql_run($host, $port, $user, $pass, $database, $sql) {
  $cnf = tempnam(sys_get_temp_dir(), 'pvmy');
  $body = "[client]\nhost={$host}\nport={$port}\nuser={$user}\npassword=" . json_encode($pass) . "\ndefault-character-set=utf8mb4\n";
  file_put_contents($cnf, $body);
  chmod($cnf, 0600);
  $cmd = 'mysql --defaults-extra-file=' . escapeshellarg($cnf) . ' --connect-timeout=8 --batch --raw ' . escapeshellarg($database);
  $descriptors = array(
    0 => array('pipe', 'r'),
    1 => array('pipe', 'w'),
    2 => array('pipe', 'w'),
  );
  $proc = proc_open($cmd, $descriptors, $pipes);
  if (!is_resource($proc)) {
    @unlink($cnf);
    throw new RuntimeException('mysql proc_open failed');
  }
  fwrite($pipes[0], $sql);
  fclose($pipes[0]);
  $stdout = stream_get_contents($pipes[1]);
  $stderr = stream_get_contents($pipes[2]);
  fclose($pipes[1]);
  fclose($pipes[2]);
  $code = proc_close($proc);
  @unlink($cnf);
  if ($code !== 0) {
    throw new RuntimeException(trim($stderr !== '' ? $stderr : $stdout));
  }
  return $stdout;
}

try {
  mysql_run($host, $port, $user, $pass, $database, "
CREATE TABLE IF NOT EXISTS `_prisma_migrations` (
  `id` VARCHAR(36) NOT NULL,
  `checksum` VARCHAR(64) NOT NULL,
  `finished_at` DATETIME(3) NULL,
  `migration_name` VARCHAR(255) NOT NULL,
  `logs` TEXT NULL,
  `rolled_back_at` DATETIME(3) NULL,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
");
  $appliedOut = mysql_run($host, $port, $user, $pass, $database, "SELECT `migration_name` FROM `_prisma_migrations` WHERE `rolled_back_at` IS NULL;");
  $applied = array();
  foreach (preg_split("/\r\n|\n|\r/", trim($appliedOut)) as $line) {
    $line = trim($line);
    if ($line === '' || $line === 'migration_name') continue;
    $applied[$line] = true;
  }

  $folders = array();
  foreach (scandir($migrationsDir) as $name) {
    if ($name === '.' || $name === '..') continue;
    if (is_dir($migrationsDir . '/' . $name)) $folders[] = $name;
  }
  sort($folders);

  $count = 0;
  foreach ($folders as $name) {
    if (isset($applied[$name])) continue;
    $sqlPath = $migrationsDir . '/' . $name . '/migration.sql';
    if (!is_file($sqlPath)) continue;
    $sql = file_get_contents($sqlPath);
    $checksum = hash('sha256', $sql);
    $id = sprintf(
      '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
      mt_rand(0, 0xffff), mt_rand(0, 0xffff),
      mt_rand(0, 0xffff),
      mt_rand(0, 0x0fff) | 0x4000,
      mt_rand(0, 0x3fff) | 0x8000,
      mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
    fwrite(STDOUT, "==> apply-migrations: {$name}\n");
    mysql_run($host, $port, $user, $pass, $database, $sql);
    mysql_run($host, $port, $user, $pass, $database, "
      INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `applied_steps_count`)
      VALUES ('{$id}', '{$checksum}', CURRENT_TIMESTAMP(3), '{$name}', 1);
    ");
    $count += 1;
  }

  if ($count === 0) {
    fwrite(STDOUT, "==> apply-migrations: already up to date\n");
  } else {
    fwrite(STDOUT, "==> apply-migrations: applied {$count}\n");
  }
} catch (Exception $e) {
  fwrite(STDERR, "==> apply-migrations: " . $e->getMessage() . "\n");
  exit(1);
}
