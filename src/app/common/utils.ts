export class Utils {

    static toLocalString(input: Date|string) {
        if (!input) {
            return ''
        }
        try {
            const test = new Date(input)
            return test.toLocaleString()
        } catch {
            return ''
        }
    }

    static getGoogleMapLink(line: string) {
        const phrase = line
        return `https://www.google.com/maps/place/${phrase}`
    }

    static getDateDayTimeRange(input: Date): DateDayTimeRange {
        const year = input.getFullYear()
        const month = (input.getMonth() + 1).toString().padStart(2, '0')
        const day = input.getDate().toString().padStart(2, '0')
        const endDay = (input.getDate()+1).toString().padStart(2, '0')
        const startOfDayText = `${year}-${month}-${day}T00:00:00.000Z`
        const endOfDayText = `${year}-${month}-${endDay}T05:00:00.000Z`
        return { start: startOfDayText, end: endOfDayText };
        // 2025-07-16T00:00:00.000Z
        // 2025-07-17T05:00:00.000Z
    }
}

export interface DateDayTimeRange {
    start: string
    end: string
}