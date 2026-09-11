import type { Metadata } from "next";
import { CreateFlow } from "@/components/create-flow";

export const metadata: Metadata = {
  title: "Создать работу — postvmeste.ru",
};

export default function Create() {
  return <CreateFlow />;
}
