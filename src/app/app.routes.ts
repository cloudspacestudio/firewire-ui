import { Routes } from '@angular/router';

const canDeactivateProjectPage = (component: any) => {
    if (component && typeof component.canDeactivate === 'function') {
        return component.canDeactivate()
    }
    return true
}

export const routes: Routes = [
    {path: 'root', loadComponent: () => import('./pages/root/home.page').then(m => m.HomePage)},
    {path: 'logged-out', loadComponent: () => import('./pages/root/logged-out.page').then(m => m.LoggedOutPage)},

    {path: 'projects', loadComponent: () => import('./pages/projects/projects.page').then(m => m.ProjectsPage)},
    {path: 'projects/awaiting-project-nbr', loadComponent: () => import('./pages/projects/awaiting-project-nbr.page').then(m => m.AwaitingProjectNbrPage)},
    {path: 'projects/fieldwire-list', loadComponent: () => import('./pages/projects/fieldwire-projects.page').then(m => m.FieldwireProjectsPage)},
    {path: 'admin', redirectTo: 'settings/project-admin', pathMatch: 'full'},
    {path: 'devices', loadComponent: () => import('./pages/devices/devices.page').then(m => m.DevicesPage)},
    {path: 'devices/:deviceId', canDeactivate: [canDeactivateProjectPage], loadComponent: () => import('./pages/devices/device.page').then(m => m.DevicePage)},
    {path: 'device-sets', loadComponent: () => import('./pages/device-sets/device-sets.page').then(m => m.DeviceSetsPage)},
    {path: 'device-sets/:deviceSetId/parts', loadComponent: () => import('./pages/device-sets/device-set-parts.page').then(m => m.DeviceSetPartsPage)},
    {path: 'device-sets/:deviceSetId', loadComponent: () => import('./pages/device-sets/device-set.page').then(m => m.DeviceSetPage)},
    {path: 'sales', loadComponent: () => import('./pages/sales/sales.page').then(m => m.SalesPage)},
    {path: 'sales/:projectId', loadComponent: () => import('./pages/sales/sales-project.page').then(m => m.SalesProjectPage)},
    {path: 'edit-markup', canDeactivate: [canDeactivateProjectPage], loadComponent: () => import('./pages/edit-markup/edit-markup.page').then(m => m.EditMarkupPage)},
    {path: 'design', loadComponent: () => import('./pages/design/design.page').then(m => m.DesignPage)},
    {path: 'design/train-ai', loadComponent: () => import('./pages/design/design-train-ai.page').then(m => m.DesignTrainAiPage)},
    {path: 'design/:projectId', loadComponent: () => import('./pages/design/design-project.page').then(m => m.DesignProjectPage)},
    {path: 'install', loadComponent: () => import('./pages/install/install.page').then(m => m.InstallPage)},
    {path: 'materials', loadComponent: () => import('./pages/materials/materials.page').then(m => m.MaterialsPage)},
    {path: 'categories', loadComponent: () => import('./pages/categories/categories.page').then(m => m.CategoriesPage)},
    {path: 'categories/:categoryId', loadComponent: () => import('./pages/categories/category.page').then(m => m.CategoryPage)},
    {path: 'vendors', loadComponent: () => import('./pages/vendors/vendors.page').then(m => m.VendorsPage)},
    {path: 'parts', redirectTo: 'parts/edwards', pathMatch: 'full'},
    {path: 'parts/:vendorKey', loadComponent: () => import('./pages/eddypricelist/eddypricelist.page').then(m => m.EddyPricelistPage)},

    {path: 'projects/:projectId/dailyreport', loadComponent: () => import('./pages/dailyreport/dailyreport.page').then(m => m.DailyReportPage)},
    {path: 'projects/:projectId/imports', loadComponent: () => import('./pages/imports/imports.page').then(m => m.ImportsPage)},
    {path: 'projects/:projectId/change-orders', loadComponent: () => import('./pages/change-orders/change-orders.page').then(m => m.ChangeOrdersPage)},
    {path: 'projects/:projectId', redirectTo: 'projects/firewire/:projectId/project-details', pathMatch: 'full'},
    {path: 'projects/:projectSource/:projectId', redirectTo: 'projects/:projectSource/:projectId/project-details', pathMatch: 'full'},
    {path: 'projects/:projectSource/:projectId/:workspaceTab', canDeactivate: [canDeactivateProjectPage], loadComponent: () => import('./pages/projects/project.page').then(m => m.ProjectPage)},

    {path: 'settings', loadComponent: () => import('./pages/settings/settings.page').then(m => m.SettingsPage)},
    {path: 'settings/project-admin', loadComponent: () => import('./pages/projects/projects-admin.page').then(m => m.ProjectsAdminPage)},
    {path: 'about', loadComponent: () => import('./pages/about/about.page').then(m => m.AboutPage)},
    {path: 'preferences', loadComponent: () => import('./pages/preferences/preferences.page').then(m => m.PreferencesPage)},
    {path: 'tech', loadComponent: () => import('./pages/tech/tech.page').then(m => m.TechPage)},

    {path: '**', loadComponent: () => import('./pages/root/home.page').then(m => m.HomePage)}
];
