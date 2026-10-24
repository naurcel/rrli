# RouteX

**Developed for Redeemed Route Logistics Inc. (RRLI)**

RouteX is a web-based **Truck Profitability and Delivery Operations Management System** for Redeemed Route Logistics Inc. It provides one place for staff to manage completed-delivery records, truck information, supporting documents, and related financial data.

The goal of RouteX is to make company records easier to organize and retrieve, while giving management a clearer view of profitability across individual deliveries, trucks, and the company as a whole.

## Main Features

- **Delivery Management** – Maintain completed delivery records, including related client, truck, crew, revenue, expense, and delivery information.
- **Fleet Management** – Keep truck records and review delivery history associated with each truck.
- **Proof of Delivery (POD)** – Upload and retrieve delivery documents linked to their records.
- **Financial Records** – Record delivery-related expenses and company expenses that are not assigned to a specific delivery.
- **Profitability Analysis** – Review delivery-, truck-, and company-level results using the financial rules approved for the system.
- **Search and Reports** – Find historical records and review operational and financial reports.
- **User Access Management** – Restrict system functions and information according to authorized user permissions.

## Intended Users

RouteX is designed for internal company use. Operations staff manage completed delivery records and PODs, Finance maintains company-level expenses, HR maintains approved compensation summaries, and management reviews records and profitability reports. Administrators manage user accounts and access settings.

## Key Principle

RouteX is intended to make financial results traceable. Management should be able to understand how recorded delivery and expense information contributes to truck-level and company-level results. An expense must not be counted more than once simply because it appears in multiple reports. Exact financial formulas and classifications are subject to the company's approved rules.

## Technology Stack

- **Application:** Next.js 15 App Router
- **Frontend:** React, TypeScript, Tailwind CSS, shadcn/ui, Lucide React
- **Server logic:** Next.js Server Actions and Route Handlers
- **Database:** PostgreSQL through Supabase
- **Authentication:** Auth.js
- **File storage:** Supabase Storage
- **Deployment:** Vercel
- **Package manager:** npm

## Scope

RouteX supports post-delivery recordkeeping, information retrieval, reporting, and profitability review. It is not intended to provide live GPS tracking, live dispatch, route optimization, a customer portal, a full accounting replacement, or a complete payroll system under the current scope.

> **Note:** RouteX's financial calculations depend on business rules confirmed by Redeemed Route Logistics Inc. Any unresolved rules should be confirmed before being treated as final system behavior.
