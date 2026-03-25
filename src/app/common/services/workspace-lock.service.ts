import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'

@Injectable({ providedIn: 'root' })
export class WorkspaceLockService {
    private readonly storageKey = 'firewire.workspace.locked'
    private readonly lockedSubject = new BehaviorSubject<boolean>(this.readLockedState())

    get locked$() {
        return this.lockedSubject.asObservable()
    }

    get isLocked(): boolean {
        return this.lockedSubject.value
    }

    lock(): void {
        this.lockedSubject.next(true)
        this.writeLockedState(true)
    }

    unlock(): void {
        this.lockedSubject.next(false)
        this.writeLockedState(false)
    }

    private readLockedState(): boolean {
        try {
            if (typeof sessionStorage === 'undefined') {
                return false
            }
            return sessionStorage.getItem(this.storageKey) === 'true'
        } catch {
            return false
        }
    }

    private writeLockedState(locked: boolean): void {
        try {
            if (typeof sessionStorage === 'undefined') {
                return
            }
            if (locked) {
                sessionStorage.setItem(this.storageKey, 'true')
                return
            }
            sessionStorage.removeItem(this.storageKey)
        } catch {
            // Ignore privacy-mode/session-storage failures and keep in-memory state.
        }
    }
}
