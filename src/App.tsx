import { BrowserRouter, Route, Routes } from 'react-router'
import { StoreProvider } from '@/app/store'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { BookingsPage } from '@/features/bookings/BookingsPage'
import { BookingDetailPage } from '@/features/bookings/BookingDetailPage'
import { EditBookingPage } from '@/features/bookings/EditBookingPage'
import { DispatchQueuePage } from '@/features/dispatch/DispatchQueuePage'
import { AwbPreviewPage } from '@/features/awb/AwbPreviewPage'
import { AwbRegisterPage } from '@/features/awb/AwbRegisterPage'
import { RefundsPage } from '@/features/refunds/RefundsPage'
import { RefundDetailPage } from '@/features/refunds/RefundDetailPage'
import { PaymentExceptionDetailPage } from '@/features/payments/PaymentExceptionDetailPage'
import { StaffPage } from '@/features/staff/StaffPage'
import { PaymentExceptionsPage } from '@/features/payments/PaymentExceptionsPage'
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage'
import { CapacityPage } from '@/features/capacity/CapacityPage'
import { LandingPage } from '@/features/landing/LandingPage'
import { VerifyAwbPage } from '@/features/awb/VerifyAwbPage'
import { DemoGuidePage } from '@/features/demo/DemoGuidePage'
import { NewBookingPage } from '@/features/bookings/NewBookingPage'
import { RegistrationsPage } from '@/features/registrations/RegistrationsPage'
import { CustomersPage } from '@/features/customers/CustomersPage'
import { CompanyProfilePage } from '@/features/customers/CompanyProfilePage'
import { AuditPage } from '@/features/audit/AuditPage'
import { RegistrationDetailPage } from '@/features/registrations/RegistrationDetailPage'
import { EditRegistrationPage, MyRegistrationRedirect, NewRegistrationPage } from '@/features/registrations/ApplicantPages'
import { MasterDataPage } from '@/features/master-data/MasterDataPage'
import { NotFoundPage, RequireArea } from '@/features/placeholder/PlannedPage'
import type { Area } from '@/lib/permissions'
import type { ReactNode } from 'react'

const guarded = (area: Area, el: ReactNode) => <RequireArea area={area}>{el}</RequireArea>

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/verify" element={<VerifyAwbPage />} />
          <Route element={<AppShell />}>
            <Route path="demo-guide" element={<DemoGuidePage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="bookings" element={guarded('bookings', <BookingsPage />)} />
            <Route path="bookings/new" element={guarded('new_booking', <NewBookingPage />)} />
            <Route path="bookings/:id/edit" element={guarded('new_booking', <EditBookingPage />)} />
            <Route path="bookings/:id" element={guarded('bookings', <BookingDetailPage />)} />
            <Route path="registrations" element={guarded('registrations', <RegistrationsPage />)} />
            <Route path="registrations/:id" element={<RegistrationDetailPage />} />
            <Route path="registrations/:id/edit" element={<EditRegistrationPage />} />
            <Route path="my-registration" element={guarded('my_registration', <MyRegistrationRedirect />)} />
            <Route path="register" element={guarded('my_registration', <NewRegistrationPage />)} />
            <Route path="company" element={guarded('company_profile', <CompanyProfilePage />)} />
            <Route path="customers" element={guarded('customers', <CustomersPage />)} />
            <Route path="customers/:id" element={guarded('customers', <CustomerDetailPage />)} />
            <Route path="dispatch" element={guarded('dispatch', <DispatchQueuePage />)} />
            <Route path="awbs" element={guarded('awbs', <AwbRegisterPage />)} />
            <Route path="bookings/:id/awb" element={guarded('awbs', <AwbPreviewPage />)} />
            <Route path="capacity" element={guarded('capacity', <CapacityPage />)} />
            <Route path="refunds" element={guarded('refunds', <RefundsPage />)} />
            <Route path="refunds/:id" element={guarded('refunds', <RefundDetailPage />)} />
            <Route path="payments" element={guarded('payments', <PaymentExceptionsPage />)} />
            <Route path="payments/:id" element={guarded('payments', <PaymentExceptionDetailPage />)} />
            <Route path="staff" element={guarded('staff', <StaffPage />)} />
            <Route path="master-data" element={guarded('master_data', <MasterDataPage />)} />
            <Route path="audit" element={guarded('audit', <AuditPage />)} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
