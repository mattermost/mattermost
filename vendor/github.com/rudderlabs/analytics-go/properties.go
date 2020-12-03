package analytics

// This type is used to represent properties in messages that support it.
// It is a free-form object so the application can set any value it sees fit but
// a few helper method are defined to make it easier to instantiate properties with
// common fields.
// Here's a quick example of how this type is meant to be used:
//
//	analytics.Page{
//		UserId: "0123456789",
//		Properties: analytics.NewProperties()
//			.SetRevenue(10.0)
//			.SetCurrency("USD"),
//	}
//
type Properties map[string]interface{}

func NewProperties() Properties {
	return make(Properties, 10)
}

func (p Properties) SetRevenue(revenue float64) Properties {
	return p.Set("revenue", revenue)
}

func (p Properties) SetCurrency(currency string) Properties {
	return p.Set("currency", currency)
}

func (p Properties) SetValue(value float64) Properties {
	return p.Set("value", value)
}

func (p Properties) SetPath(path string) Properties {
	return p.Set("path", path)
}

func (p Properties) SetReferrer(referrer string) Properties {
	return p.Set("referrer", referrer)
}

func (p Properties) SetTitle(title string) Properties {
	return p.Set("title", title)
}

func (p Properties) SetURL(url string) Properties {
	return p.Set("url", url)
}

func (p Properties) SetName(name string) Properties {
	return p.Set("name", name)
}

func (p Properties) SetCategory(category string) Properties {
	return p.Set("category", category)
}

func (p Properties) SetSKU(sku string) Properties {
	return p.Set("sku", sku)
}

func (p Properties) SetPrice(price float64) Properties {
	return p.Set("price", price)
}

func (p Properties) SetProductId(id string) Properties {
	return p.Set("id", id)
}

func (p Properties) SetOrderId(id string) Properties {
	return p.Set("orderId", id)
}

func (p Properties) SetTotal(total float64) Properties {
	return p.Set("total", total)
}

func (p Properties) SetSubtotal(subtotal float64) Properties {
	return p.Set("subtotal", subtotal)
}

func (p Properties) SetShipping(shipping float64) Properties {
	return p.Set("shipping", shipping)
}

func (p Properties) SetTax(tax float64) Properties {
	return p.Set("tax", tax)
}

func (p Properties) SetDiscount(discount float64) Properties {
	return p.Set("discount", discount)
}

func (p Properties) SetCoupon(coupon string) Properties {
	return p.Set("coupon", coupon)
}

func (p Properties) SetProducts(products ...Product) Properties {
	return p.Set("products", products)
}

func (p Properties) SetRepeat(repeat bool) Properties {
	return p.Set("repeat", repeat)
}

func (p Properties) Set(name string, value interface{}) Properties {
	p[name] = value
	return p
}

// This type represents products in the E-commerce API.
type Product struct {
	ID    string  `json:"id,omitempty"`
	SKU   string  `json:"sky,omitempty"`
	Name  string  `json:"name,omitempty"`
	Price float64 `json:"price"`
}
