export interface VwPart {
    partId?: string
    vendorId?: string | null
    vendorName?: string | null
    sourceVendorName?: string | null
    brand?: string | null
    parentCategory: string
    category: string
    partNumber: string
    description: string
    msrp: number
    cost: number
    minQty: number
    upc: string
    productStatus?: string | null
    agency?: string | null
    countryOfOrigin?: string | null

    // Compatibility aliases used by existing BOM/device UI while Parts naming is adopted.
    ParentCategory: string
    Category: string
    PartNumber: string
    LongDescription: string
    MSRPPrice: number
    SalesPrice: number
    FuturePrice?: number | null
    FutureEffectiveDate?: Date | string | null
    FutureSalesPrice?: number | null
    FutureSalesEffectiveDate?: Date | string | null
    MinOrderQuantity: number
    ProductStatus?: string | null
    Agency?: string | null
    CountryOfOrigin?: string | null
    UPC: string
    ProductID?: string
    PrimaryImage?: string | null
    QuantityAvailable?: number | null
}
