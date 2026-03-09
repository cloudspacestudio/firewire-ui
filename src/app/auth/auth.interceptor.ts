import { HttpInterceptorFn } from '@angular/common/http'
import { inject } from '@angular/core'
import { from } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { environment } from '../../environments/environment'
import { AuthService } from './auth.service'

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    if (!shouldAttachToken(req.url)) {
        return next(req)
    }

    const auth = inject(AuthService)
    return from(auth.getAccessToken()).pipe(
        switchMap((token) => {
            if (!token) {
                return next(req)
            }
            return next(req.clone({
                setHeaders: {
                    Authorization: `Bearer ${token}`
                }
            }))
        })
    )
}

function shouldAttachToken(url: string): boolean {
    return environment.auth.protectedResourceStartsWith.some((prefix) => url.startsWith(prefix))
}
