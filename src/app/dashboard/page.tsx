import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";

export const metadata: Metadata = {
  title: "Студия — postvmeste.ru",
};

export default function Dashboard() {
  return <HomePage />;
}
