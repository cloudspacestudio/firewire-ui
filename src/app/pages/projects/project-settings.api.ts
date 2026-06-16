import { Injectable, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { map, Observable } from 'rxjs'
import { createEmptyProjectSettingsCatalog, ProjectSettingsCatalogSchema } from '../../schemas/project-settings.schema'

@Injectable({ providedIn: 'root' })
export class ProjectSettingsApi {
    private http = inject(HttpClient)

    getCatalog(): Observable<ProjectSettingsCatalogSchema> {
        return this.http.get<{ data?: ProjectSettingsCatalogSchema }>('/api/firewire/project-settings').pipe(
            map((response) => {
                return response?.data || createEmptyProjectSettingsCatalog()
            })
        )
    }
}
