import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CategoriesProvider } from './contexts/CategoriesContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Transactions from './pages/Transactions'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import ConstructionStaff from './pages/ConstructionStaff'
import Vendors from './pages/Vendors'
import WorkReport from './pages/WorkReport'
import Employees from './pages/Employees'
import BidForm from './pages/BidForm'
import Bids from './pages/Bids'
import MaterialFrequency from './pages/MaterialFrequency'
import Estimates from './pages/Estimates'
import EstimateForm from './pages/EstimateForm'
import EstimateDetail from './pages/EstimateDetail'
import EstimatePriceList from './pages/EstimatePriceList'
import Contracts from './pages/Contracts'
import ContractForm from './pages/ContractForm'

function App() {
  return (
    <BrowserRouter>
      <CategoriesProvider>
        <Routes>
          <Route path="bid/:projectId" element={<BidForm />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="staff" element={<ConstructionStaff />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="work-report" element={<WorkReport />} />
            <Route path="employees" element={<Employees />} />
            <Route path="bids" element={<Bids />} />
            <Route path="material-frequency" element={<MaterialFrequency />} />
            <Route path="estimates" element={<Estimates />} />
            <Route path="estimates/new" element={<EstimateForm />} />
            <Route path="estimates/price-list" element={<EstimatePriceList />} />
            <Route path="estimates/:id" element={<EstimateDetail />} />
            <Route path="estimates/:id/edit" element={<EstimateForm />} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="contracts/new" element={<ContractForm />} />
            <Route path="contracts/:id/edit" element={<ContractForm />} />
          </Route>
        </Routes>
      </CategoriesProvider>
    </BrowserRouter>
  )
}

export default App
