import { Injectable } from '@angular/core'

export type ViewSortDirection = '' | 'asc' | 'desc'

export interface ViewSortPreference {
    active: string
    direction: ViewSortDirection
}

@Injectable({
    providedIn: 'root'
})
export class ViewPreferencesService {
    readText(key: string, fallback = ''): string {
        return this.readRaw(key) ?? fallback
    }

    writeText(key: string, value: string): void {
        this.writeRaw(key, value)
    }

    readJson<T>(key: string, fallback: T, normalize?: (value: unknown) => T): T {
        const raw = this.readRaw(key)
        if (raw === null) {
            return fallback
        }

        try {
            const parsed = JSON.parse(raw)
            return normalize ? normalize(parsed) : parsed as T
        } catch {
            return fallback
        }
    }

    writeJson(key: string, value: unknown): void {
        try {
            this.writeRaw(key, JSON.stringify(value))
        } catch {
            return
        }
    }

    readNumber(key: string, fallback: number, allowedValues?: number[]): number {
        const raw = Number(this.readRaw(key) ?? fallback)
        if (!Number.isFinite(raw)) {
            return fallback
        }
        return allowedValues && !allowedValues.includes(raw) ? fallback : raw
    }

    writeNumber(key: string, value: number): void {
        this.writeRaw(key, String(value))
    }

    readSort(key: string, fallback: ViewSortPreference): ViewSortPreference {
        return this.readJson<ViewSortPreference>(key, fallback, (value) => {
            if (!value || typeof value !== 'object') {
                return fallback
            }
            const candidate = value as { active?: unknown, direction?: unknown }
            const active = typeof candidate.active === 'string' && candidate.active.trim()
                ? candidate.active
                : fallback.active
            const direction = candidate.direction === 'asc' || candidate.direction === 'desc' || candidate.direction === ''
                ? candidate.direction
                : fallback.direction
            return { active, direction }
        })
    }

    writeSort(key: string, value: ViewSortPreference): void {
        this.writeJson(key, value)
    }

    remove(key: string): void {
        if (!this.canUseStorage()) {
            return
        }

        try {
            localStorage.removeItem(key)
        } catch {
            return
        }
    }

    private readRaw(key: string): string | null {
        if (!this.canUseStorage()) {
            return null
        }

        try {
            return localStorage.getItem(key)
        } catch {
            return null
        }
    }

    private writeRaw(key: string, value: string): void {
        if (!this.canUseStorage()) {
            return
        }

        try {
            localStorage.setItem(key, value)
        } catch {
            return
        }
    }

    private canUseStorage(): boolean {
        return typeof localStorage !== 'undefined'
    }
}
