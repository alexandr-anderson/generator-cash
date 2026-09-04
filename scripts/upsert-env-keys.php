<?php
/**
 * Upsert KEY=value lines from an incoming file into a dotenv file.
 * Usage: php upsert-env-keys.php /path/to/.env /path/to/incoming
 * Prints only key names and value lengths — never secret values.
 */
if ($argc < 3) {
  fwrite(STDERR, "Usage: php upsert-env-keys.php <env-file> <incoming-file>\n");
  exit(1);
}

$envFile = $argv[1];
$incomingFile = $argv[2];

if (!is_file($incomingFile)) {
  fwrite(STDERR, "Missing incoming file\n");
  exit(1);
}
if (!is_file($envFile)) {
  fwrite(STDERR, "Missing env file\n");
  exit(1);
}

function parse_kv_lines(string $path): array {
  $out = [];
  foreach (file($path, FILE_IGNORE_NEW_LINES) as $raw) {
    $line = trim($raw);
    if ($line === "" || str_starts_with($line, "#")) continue;
    $eq = strpos($line, "=");
    if ($eq === false || $eq === 0) continue;
    $key = trim(substr($line, 0, $eq));
    $value = trim(substr($line, $eq + 1));
    if (
      (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
      (str_starts_with($value, "'") && str_ends_with($value, "'"))
    ) {
      $value = substr($value, 1, -1);
    }
    $out[$key] = $value;
  }
  return $out;
}

$incoming = parse_kv_lines($incomingFile);
if (!$incoming) {
  fwrite(STDERR, "Incoming file has no KEY=value lines\n");
  exit(1);
}

$lines = file($envFile, FILE_IGNORE_NEW_LINES);
if ($lines === false) {
  fwrite(STDERR, "Cannot read env file\n");
  exit(1);
}

$seen = [];
$next = [];
foreach ($lines as $raw) {
  $trim = trim($raw);
  $eq = strpos($trim, "=");
  $key = ($trim !== "" && !str_starts_with($trim, "#") && $eq !== false)
    ? trim(substr($trim, 0, $eq))
    : null;
  if ($key !== null && array_key_exists($key, $incoming)) {
    $next[] = $key . "=" . $incoming[$key];
    $seen[$key] = true;
  } else {
    $next[] = $raw;
  }
}

foreach ($incoming as $key => $value) {
  if (!isset($seen[$key])) {
    $next[] = $key . "=" . $value;
  }
}

$payload = implode("\n", $next);
if ($payload !== "" && !str_ends_with($payload, "\n")) {
  $payload .= "\n";
}

$tmp = $envFile . ".tmp";
if (file_put_contents($tmp, $payload) === false) {
  fwrite(STDERR, "Cannot write temp env file\n");
  exit(1);
}
if (!rename($tmp, $envFile)) {
  fwrite(STDERR, "Cannot replace env file\n");
  exit(1);
}

foreach ($incoming as $key => $value) {
  echo $key . " len=" . strlen($value) . "\n";
}
echo "ok\n";
