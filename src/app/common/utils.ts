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

    static getDateDayTimeRange(startDate: Date): DateDayTimeRange {
        const year = startDate.getFullYear()
        const month = (startDate.getMonth() + 1).toString().padStart(2, '0')
        const day = startDate.getDate().toString().padStart(2, '0')
        
        const endDate = new Date(startDate.getTime() + (1000 * 60 * 60 * 24))
        const endyear = endDate.getFullYear()
        const endmonth = (endDate.getMonth() + 1).toString().padStart(2, '0')
        const endday = endDate.getDate().toString().padStart(2, '0')

        const startOfDayText = `${year}-${month}-${day}T05:00:00.000Z`
        const endOfDayText = `${endyear}-${endmonth}-${endday}T05:00:00.000Z`
        return { start: startOfDayText, end: endOfDayText };
        // 2025-07-16T00:00:00.000Z
        // 2025-07-17T05:00:00.000Z
    }
}

export interface DateDayTimeRange {
    start: string
    end: string
}