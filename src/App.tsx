import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { StoreProvider } from '@/app/store'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { BookingsPage } from '@/features/bookings/BookingsPage'
import { RegistrationsPage } from '@/features/registrations/RegistrationsPage'
import { CustomersPage } from '@/features/customers/CustomersPage'
import { CompanyProfilePage } from '@/features/customers/CompanyProfilePage'
import { AuditPage } from '@/features/audit/AuditPage'
import { RegistrationDetailPage } from '@/features/registrations/RegistrationDetailPage'
import { EditRegistrationPage, MyRegistrationRedirect, NewRegistrationPage } from '@/features/registrations/ApplicantPages'
import { MasterDataPage } from '@/features/master-data/MasterDataPage'
import { NotFoundPage, PlannedPage, RequireArea } from '@/features/placeholder/PlannedPage'
import type { Area } from '@/lib/permissions'
import type { ReactNode } from 'react'

const guarded = (area: Area, el: ReactNode) => <RequireArea area={area}>{el}</RequireArea>

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="bookings" element={guarded('bookings', <BookingsPage />)} />
            <Route path="bookings/new" element={guarded('new_booking', <PlannedPage area="new_booking" />)} />
            <Route path="registrations" element={guarded('registrations', <RegistrationsPage />)} />
            <Route path="registrations/:id" element={<RegistrationDetailPage />} />
            <Route path="registrations/:id/edit" element={<EditRegistrationPage />} />
            <Route path="my-registration" element={guarded('my_registration', <MyRegistrationRedirect />)} />
            <Route path="register" element={guarded('my_registration', <NewRegistrationPage />)} />
            <Route path="company" element={guarded('company_profile', <CompanyProfilePage />)} />
            <Route path="customers" element={guarded('customers', <CustomersPage />)} />
            <Route path="dispatch" element={guarded('dispatch', <PlannedPage area="dispatch" />)} />
            <Route path="awbs" element={guarded('awbs', <PlannedPage area="awbs" />)} />
            <Route path="refunds" element={guarded('refunds', <PlannedPage area="refunds" />)} />
            <Route path="payments" element={guarded('payments', <PlannedPage area="payments" />)} />
            <Route path="staff" element={guarded('staff', <PlannedPage area="staff" />)} />
            <Route path="master-data" element={guarded('master_data', <MasterDataPage />)} />
            <Route path="audit" element={guarded('audit', <AuditPage />)} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
