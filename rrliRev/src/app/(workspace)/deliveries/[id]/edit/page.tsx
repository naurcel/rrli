"use client";

import { use } from "react";
import NewCompletedDeliveryPage from "@/app/(workspace)/deliveries/new/page";

export default function EditDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <NewCompletedDeliveryPage editDeliveryId={id} />;
}
