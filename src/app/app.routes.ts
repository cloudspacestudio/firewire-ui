import { Routes } from '@angular/router';

export const routes: Routes = [
    {path: 'root', loadComponent: () => import('./pages/root/home.page').then(m => m.HomePage)},

    {path: 'projects', loadComponent: () => import('./pages/projects/projects.page').then(m => m.ProjectsPage)},
    {path: 'projects/:projectId', loadComponent: () => import('./pages/projects/project.page').then(m => m.ProjectPage)},

    {path: 'devices', loadComponent: () => import('./pages/devices/devices.page').then(m => m.DevicesPage)},
    {path: 'devices/:deviceId', loadComponent: () => import('./pages/devices/device.page').then(m => m.DevicePage)},
    {path: 'materials', loadComponent: () => import('./pages/materials/materials.page').then(m => m.MaterialsPage)},
    {path: 'categories', loadComponent: () => import('./pages/categories/categories.page').then(m => m.CategoriesPage)},
    {path: 'vendors', loadComponent: () => import('./pages/vendors/vendors.page').then(m => m.VendorsPage)},
    {path: 'parts', loadComponent: () => import('./pages/eddypricelist/eddypricelist.page').then(m => m.EddyPricelistPage)},

    {path: 'projects/:projectId/imports', loadComponent: () => import('./pages/imports/imports.page').then(m => m.ImportsPage)},

    {path: 'settings', loadComponent: () => import('./pages/settings/settings.page').then(m => m.SettingsPage)},

    {path: '**', loadComponent: () => import('./pages/root/home.page').then(m => m.HomePage)}
];
