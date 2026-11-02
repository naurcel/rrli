"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { OperationalSidebar } from "@/components/operational-sidebar";
import { OperationalTopbar } from "@/components/operational-topbar";
import { RoundedSelect } from "@/components/rounded-select";
import { Icon } from "@/components/route-x-ui";
import { fleetTruckTypes, ownedFleetTrucks, type FleetTruckType } from "@/features/fleet/fleet-preview-data";
import { readCreatedFleetTrucks, saveCreatedFleetTruck } from "@/features/fleet/fleet-local-preview";

function normalizePlate(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export default function NewFleetTruckPage() {
  const router = useRouter();
  const [plate, setPlate] = useState("");
  const [type, setType] = useState<FleetTruckType>("6-wheeler");
  const [error, setError] = useState("");

  const createProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = normalizePlate(plate);
    if (!id) {
      setError("Enter a plate number to create a truck profile.");
      return;
    }
    const duplicate = [...ownedFleetTrucks, ...readCreatedFleetTrucks()].some((truck) => truck.id === id);
    if (duplicate) {
      setError("A local profile already uses that plate number.");
      return;
    }
    saveCreatedFleetTruck({ id, type, status: "Active", revenue: "—", expenses: "—", margin: "—", createdAt: new Date().toISOString() });
    router.push(`/fleet/${encodeURIComponent(id)}`);
  };

  return <div className="app-shell"><OperationalSidebar /><main className="main-content"><OperationalTopbar /><div className="content-wrap fleet-detail-page truck-create-page"><Link className="back-link" href="/fleet">‹ Back to fleet</Link><section className="page-intro"><div><h1>Create truck profile</h1><p className="subtitle">Start with a plate number and vehicle type. This creates a local browser-only profile.</p></div></section><section className="records-card truck-create-card"><div className="records-heading"><div><h2>Vehicle identity</h2><p>Required profile basics</p></div></div><form onSubmit={createProfile} className="truck-create-form"><label>Plate number<input value={plate} onChange={(event) => { setPlate(event.target.value); setError(""); }} placeholder="e.g. ABC 1234" autoComplete="off" autoFocus /></label><div><span>Vehicle type</span><RoundedSelect ariaLabel="Choose vehicle type" options={fleetTruckTypes} value={type} onChange={(value) => setType(value as FleetTruckType)} /></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="truck-create-actions"><Link className="filter-button" href="/fleet">Cancel</Link><button className="primary-button" type="submit"><Icon>＋</Icon> Create local profile</button></div></form></section><p className="scope-note"><span>●</span> The profile and any photo you add are stored only in this browser. No fleet record, financial value, permission, or audit event is sent to a server.</p></div></main></div>;
}
