import { redirect } from "next/navigation";

export default function PermissionsPage() {
  redirect("/user-management#permissions");
}
