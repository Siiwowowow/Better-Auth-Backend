# AN Corporation GraphQL API

The business API is available at `POST /graphql`. REST business routes are not mounted.

Authentication mutations return short-lived `accessToken` and `refreshToken`.
Send the access token on later requests:

```http
Authorization: Bearer <accessToken>
```

Example public query:

```graphql
query Products($search: String) {
  products(search: $search, page: 1, limit: 20) {
    items { id name slug price stock images category { id name slug } }
    meta { page limit total totalPages }
  }
}
```

Example checkout:

```graphql
mutation Checkout($addressId: ID!) {
  createOrder(addressId: $addressId, paymentMethod: DEMO) {
    id orderNumber total paymentStatus
    payments { transactionId provider status }
  }
}
```

Main operations: `me`, `categories`, `products`, `cart`, `orders`, `addresses`,
`wishlist`, `register`, `login`, `createOrder`, `payDemoOrder`, product/category
admin mutations, reviews, and wishlist mutations.
