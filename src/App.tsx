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
          </Route>
        </Routes>
      </CategoriesProvider>
    </BrowserRouter>
  )
}

export default App
