import type { Metadata } from "next";
import { ProfilePage } from "@/components/profile-page";

export const metadata: Metadata = {
  title: "Профиль — postvmeste.ru",
};

export default function Profile() {
  return <ProfilePage />;
}
