import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";

export const metadata: Metadata = {
  title: "Вход — postvmeste.ru",
};

export default function Auth() {
  return <AuthPage />;
}
