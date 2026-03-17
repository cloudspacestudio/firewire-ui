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
    {path: 'projects/fieldwire-list', loadComponent: () => import('./pages/projects/fieldwire-projects.page').then(m => m.FieldwireProjectsPage)},
    {path: 'admin', loadComponent: () => import('./pages/projects/projects-admin.page').then(m => m.ProjectsAdminPage)},
    {path: 'devices', loadComponent: () => import('./pages/devices/devices.page').then(m => m.DevicesPage)},
    {path: 'devices/:deviceId', loadComponent: () => import('./pages/devices/device.page').then(m => m.DevicePage)},
    {path: 'sales', loadComponent: () => import('./pages/sales/sales.page').then(m => m.SalesPage)},
    {path: 'design', loadComponent: () => import('./pages/design/design.page').then(m => m.DesignPage)},
    {path: 'install', loadComponent: () => import('./pages/install/install.page').then(m => m.InstallPage)},
    {path: 'materials', loadComponent: () => import('./pages/materials/materials.page').then(m => m.MaterialsPage)},
    {path: 'categories', loadComponent: () => import('./pages/categories/categories.page').then(m => m.CategoriesPage)},
    {path: 'vendors', loadComponent: () => import('./pages/vendors/vendors.page').then(m => m.VendorsPage)},
    {path: 'parts', loadComponent: () => import('./pages/eddypricelist/eddypricelist.page').then(m => m.EddyPricelistPage)},

    {path: 'projects/:projectId/dailyreport', loadComponent: () => import('./pages/dailyreport/dailyreport.page').then(m => m.DailyReportPage)},
    {path: 'projects/:projectId/imports', loadComponent: () => import('./pages/imports/imports.page').then(m => m.ImportsPage)},
    {path: 'projects/:projectId', redirectTo: 'projects/firewire/:projectId/project-details', pathMatch: 'full'},
    {path: 'projects/:projectSource/:projectId', redirectTo: 'projects/:projectSource/:projectId/project-details', pathMatch: 'full'},
    {path: 'projects/:projectSource/:projectId/:workspaceTab', canDeactivate: [canDeactivateProjectPage], loadComponent: () => import('./pages/projects/project.page').then(m => m.ProjectPage)},

    {path: 'settings', loadComponent: () => import('./pages/settings/settings.page').then(m => m.SettingsPage)},
    {path: 'about', loadComponent: () => import('./pages/about/about.page').then(m => m.AboutPage)},
    {path: 'preferences', loadComponent: () => import('./pages/preferences/preferences.page').then(m => m.PreferencesPage)},
    {path: 'tech', loadComponent: () => import('./pages/tech/tech.page').then(m => m.TechPage)},

    {path: '**', loadComponent: () => import('./pages/root/home.page').then(m => m.HomePage)}
];
