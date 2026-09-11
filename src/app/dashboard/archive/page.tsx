import type { Metadata } from "next";
import { ArchivePage } from "@/components/archive-page";

export const metadata: Metadata = {
  title: "Архив — postvmeste.ru",
};

export default function Archive() {
  return <ArchivePage />;
}
