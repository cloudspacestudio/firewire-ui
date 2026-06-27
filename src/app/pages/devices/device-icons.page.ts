import { CommonModule } from '@angular/common'
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { RouterLink } from '@angular/router'
import { firstValueFrom } from 'rxjs'

import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatFormFieldModule } from '@angular/material/form-field'

import { PageToolbar } from '../../common/components/page-toolbar'
import { NavToolbar } from '../../common/components/nav-toolbar'
import { DeviceIcon, DeviceIconGroup } from '../../schemas/device-icon.schema'

@Component({
    standalone: true,
    selector: 'device-icons-page',
    imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatInputModule, MatFormFieldModule, PageToolbar, NavToolbar],
    templateUrl: './device-icons.page.html',
    styleUrls: ['./device-icons.page.scss']
})
export class DeviceIconsPage implements OnInit {
    @ViewChild('uploadInput') uploadInput?: ElementRef<HTMLInputElement>
    @ViewChild('replaceInput') replaceInput?: ElementRef<HTMLInputElement>

    navItems = NavToolbar.DeviceNavItems
    groups: DeviceIconGroup[] = []
    selectedGroupId = ''
    newGroupName = ''
    statusText = ''
    pageWorking = true
    actionWorking = false
    replacingIcon?: DeviceIcon
    readonly previewForegroundColor = '#210507'

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        void this.loadGroups()
    }

    get selectedGroup(): DeviceIconGroup | undefined {
        return this.groups.find((group) => group.iconGroupId === this.selectedGroupId) || this.groups[0]
    }

    async loadGroups(): Promise<void> {
        this.pageWorking = true
        try {
            const response = await firstValueFrom(this.http.get<{ rows?: DeviceIconGroup[] }>('/api/firewire/device-icons'))
            this.groups = Array.isArray(response?.rows) ? response.rows : []
            if (!this.selectedGroupId || !this.groups.some((group) => group.iconGroupId === this.selectedGroupId)) {
                this.selectedGroupId = this.groups[0]?.iconGroupId || ''
            }
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Unable to load icon groups.'
        } finally {
            this.pageWorking = false
        }
    }

    selectGroup(group: DeviceIconGroup): void {
        this.selectedGroupId = group.iconGroupId
    }

    async createGroup(): Promise<void> {
        const name = this.newGroupName.trim()
        if (!name) {
            return
        }
        await this.runAction('Creating icon group...', async() => {
            const response = await firstValueFrom(this.http.post<{ iconGroupId?: string }>('/api/firewire/device-icons/groups', { name }))
            this.newGroupName = ''
            this.selectedGroupId = response.iconGroupId || this.selectedGroupId
            await this.loadGroups()
        })
    }

    async renameGroup(group: DeviceIconGroup): Promise<void> {
        const name = String(group.name || '').trim()
        if (!name) {
            await this.loadGroups()
            return
        }
        await this.runAction('Renaming icon group...', async() => {
            await firstValueFrom(this.http.put(`/api/firewire/device-icons/groups/${group.iconGroupId}`, { name }))
            await this.loadGroups()
        })
    }

    async deleteGroup(group: DeviceIconGroup): Promise<void> {
        if (!globalThis.confirm(`Delete icon group "${group.name}" and all icons in it? Device assignments using those icons will be cleared.`)) {
            return
        }
        await this.runAction('Deleting icon group...', async() => {
            await firstValueFrom(this.http.delete(`/api/firewire/device-icons/groups/${group.iconGroupId}`))
            if (this.selectedGroupId === group.iconGroupId) {
                this.selectedGroupId = ''
            }
            await this.loadGroups()
        })
    }

    openUpload(): void {
        this.uploadInput?.nativeElement.click()
    }

    openReplace(icon: DeviceIcon): void {
        this.replacingIcon = icon
        this.replaceInput?.nativeElement.click()
    }

    async onUploadSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement
        const files = Array.from(input.files || [])
        input.value = ''
        const group = this.selectedGroup
        if (!group || files.length <= 0) {
            return
        }
        await this.runAction('Uploading icons...', async() => {
            for (const file of files) {
                const dataUrl = await this.readFileAsDataUrl(file)
                await firstValueFrom(this.http.post(`/api/firewire/device-icons/groups/${group.iconGroupId}/icons`, {
                    label: this.getDefaultIconLabel(file.name),
                    fileName: file.name,
                    mimeType: file.type || 'image/*',
                    dataUrl
                }))
            }
            await this.loadGroups()
        })
    }

    async onReplaceSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]
        input.value = ''
        const icon = this.replacingIcon
        this.replacingIcon = undefined
        if (!file || !icon) {
            return
        }
        await this.runAction('Replacing icon image...', async() => {
            const dataUrl = await this.readFileAsDataUrl(file)
            await firstValueFrom(this.http.put(`/api/firewire/device-icons/icons/${icon.iconId}`, {
                fileName: file.name,
                mimeType: file.type || 'image/*',
                dataUrl
            }))
            await this.loadGroups()
        })
    }

    async saveIconLabel(icon: DeviceIcon): Promise<void> {
        const label = String(icon.label || '').trim()
        if (!label) {
            await this.loadGroups()
            return
        }
        await this.runAction('Saving icon label...', async() => {
            await firstValueFrom(this.http.put(`/api/firewire/device-icons/icons/${icon.iconId}`, { label }))
            await this.loadGroups()
        })
    }

    async deleteIcon(icon: DeviceIcon): Promise<void> {
        if (!globalThis.confirm(`Delete icon "${icon.label}"? Device assignments using it will be cleared.`)) {
            return
        }
        await this.runAction('Deleting icon...', async() => {
            await firstValueFrom(this.http.delete(`/api/firewire/device-icons/icons/${icon.iconId}`))
            await this.loadGroups()
        })
    }

    getIconPreviewStyle(icon: DeviceIcon): Record<string, string> {
        const dataUrl = String(icon?.dataUrl || '').trim()
        return dataUrl
            ? {
                'background-color': this.previewForegroundColor,
                'mask-image': `url("${dataUrl}")`,
                '-webkit-mask-image': `url("${dataUrl}")`,
            }
            : {}
    }

    private async runAction(workingText: string, action: () => Promise<void>): Promise<void> {
        this.actionWorking = true
        this.statusText = workingText
        try {
            await action()
            this.statusText = ''
        } catch (err: any) {
            this.statusText = err?.error?.message || err?.message || 'Icon action failed.'
        } finally {
            this.actionWorking = false
        }
    }

    private readFileAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(reader.error || new Error('Unable to read icon file.'))
            reader.readAsDataURL(file)
        })
    }

    private getDefaultIconLabel(fileName: string): string {
        return String(fileName || 'Icon')
            .replace(/\.[^.]+$/, '')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim() || 'Icon'
    }
}
