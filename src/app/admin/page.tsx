import type { Metadata } from "next";
import { AdminPage } from "@/components/admin-page";

export const metadata: Metadata = {
  title: "Админка — postvmeste.ru",
};

export default function Admin() {
  return <AdminPage />;
}
