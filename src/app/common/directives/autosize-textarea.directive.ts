import {
    AfterViewInit,
    Directive,
    DoCheck,
    ElementRef,
    HostListener,
    NgZone,
    OnDestroy
} from '@angular/core'

@Directive({
    standalone: true,
    selector: 'textarea[fwAutosizeTextarea]'
})
export class AutosizeTextareaDirective implements AfterViewInit, DoCheck, OnDestroy {
    private previousValue = ''
    private previousWidth = 0
    private resizeObserver?: ResizeObserver
    private frameId = 0

    constructor(
        private readonly elementRef: ElementRef<HTMLTextAreaElement>,
        private readonly zone: NgZone
    ) {}

    ngAfterViewInit(): void {
        this.zone.runOutsideAngular(() => {
            this.resizeObserver = new ResizeObserver(() => this.scheduleResize())
            this.resizeObserver.observe(this.elementRef.nativeElement)
            this.scheduleResize()
        })
    }

    ngDoCheck(): void {
        const element = this.elementRef.nativeElement
        const width = element.clientWidth

        if (element.value !== this.previousValue || width !== this.previousWidth) {
            this.previousValue = element.value
            this.previousWidth = width
            this.scheduleResize()
        }
    }

    ngOnDestroy(): void {
        if (this.frameId) {
            cancelAnimationFrame(this.frameId)
        }
        this.resizeObserver?.disconnect()
    }

    @HostListener('input')
    onInput(): void {
        this.previousValue = this.elementRef.nativeElement.value
        this.scheduleResize()
    }

    private scheduleResize(): void {
        if (this.frameId) {
            cancelAnimationFrame(this.frameId)
        }

        this.frameId = requestAnimationFrame(() => {
            this.frameId = 0
            this.resize()
        })
    }

    private resize(): void {
        const element = this.elementRef.nativeElement
        element.style.height = 'auto'
        element.style.height = `${element.scrollHeight}px`
    }
}
