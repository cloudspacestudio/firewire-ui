import { Routes } from '@angular/router';

export const routes: Routes = [
    {path: 'home', loadComponent: () => import('./home/home.page').then(m => m.HomePage)},
    {path: 'project/:projectId', loadComponent: () => import('./project/project.page').then(m => m.ProjectPage)},
    {path: '**', loadComponent: () => import('./home/home.page').then(m => m.HomePage)}
];
