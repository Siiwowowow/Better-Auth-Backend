/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSchema } from "graphql-yoga";
import { GraphQLError } from "graphql";
import { Role } from "@prisma/client";
import { AuthService } from "../module/auth/auth.service.js";
import { CategoryService } from "../module/category/category.service.js";
import { ProductService } from "../module/product/product.service.js";
import { CartService } from "../module/cart/cart.service.js";
import { OrderService } from "../module/order/order.service.js";
import { AddressService } from "../module/address/address.service.js";
import { ReviewService } from "../module/review/review.service.js";
import { WishlistService } from "../module/wishlist/wishlist.service.js";
import { PaymentService } from "../module/payment/payment.service.js";
import { AdminDashboardService } from "../module/admin/admin.dashboard.service.js";
import { GraphQLContext } from "./context.js";
import { tokenUtils } from "../utils/token.js";

const typeDefs = /* GraphQL */ `
  scalar DateTime
  enum Role { ADMIN USER }
  enum ProductStatus { DRAFT ACTIVE ARCHIVED }
  enum OrderStatus { PENDING CONFIRMED PROCESSING SHIPPED DELIVERED CANCELLED }
  enum PaymentStatus { UNPAID PAID FAILED REFUNDED }
  enum PaymentMethod { CASH_ON_DELIVERY DEMO }

  type User { id: ID!, name: String, email: String!, image: String, role: Role!, status: String, emailVerified: Boolean, isDeleted: Boolean, needPasswordChange: Boolean }
  type SessionCookie { name: String!, value: String!, maxAge: Int! }
  type AuthPayload { user: User!, accessToken: String, refreshToken: String, sessionCookie: SessionCookie }
  type Category { id: ID!, name: String!, slug: String!, description: String, image: String, isActive: Boolean!, productCount: Int, createdAt: DateTime!, updatedAt: DateTime! }
  type Review { id: ID!, rating: Int!, comment: String, isPublished: Boolean!, createdAt: DateTime!, user: User }
  type ProductVariant { id: ID!, name: String!, sku: String!, attributes: String!, price: Float!, compareAtPrice: Float, stock: Int!, lowStockAt: Int!, isActive: Boolean! }
  type Product { id: ID!, name: String!, slug: String!, sku: String!, description: String, brand: String, price: Float!, compareAtPrice: Float, stock: Int!, lowStockAt: Int, sold: Int, status: ProductStatus!, isWholesale: Boolean!, minWholesaleQty: Int!, images: [String!]!, categoryId: ID!, category: Category, variants: [ProductVariant!]!, reviews: [Review!]!, createdAt: DateTime!, updatedAt: DateTime! }
  type PageInfo { page: Int!, limit: Int!, total: Int!, totalPages: Int! }
  type ProductPage { items: [Product!]!, meta: PageInfo! }
  type CartItem { id: ID!, quantity: Int!, product: Product! }
  type Cart { id: ID!, items: [CartItem!]!, updatedAt: DateTime! }
  type Address { id: ID!, label: String, recipientName: String!, phone: String!, addressLine: String!, city: String!, area: String, postalCode: String, isDefault: Boolean!, createdAt: DateTime!, updatedAt: DateTime! }
  type Payment { id: ID!, provider: String!, transactionId: String!, amount: Float!, status: PaymentStatus!, createdAt: DateTime! }
  type Shipment { id: ID!, courier: String, trackingNumber: String, status: String! }
  type OrderItem { id: ID!, productId: ID!, productName: String!, sku: String!, unitPrice: Float!, quantity: Int! }
  type Order { id: ID!, orderNumber: String!, subtotal: Float!, deliveryFee: Float!, discountAmount: Float, total: Float!, status: OrderStatus!, paymentStatus: PaymentStatus!, paymentMethod: PaymentMethod!, note: String, items: [OrderItem!]!, address: Address!, user: User, payments: [Payment!]!, shipment: Shipment, createdAt: DateTime!, updatedAt: DateTime! }
  type WishlistItem { id: ID!, product: Product! }
  type DashboardStatTotals { totalSales: Float!, totalOrders: Int!, totalProducts: Int!, pendingOrders: Int! }
  type DashboardPoint { label: String!, value: Float! }
  type DashboardRevenuePoint { month: String!, sales: Float!, orders: Int! }
  type DashboardCustomerPoint { month: String!, customers: Int! }
  type DashboardTopProduct { id: ID!, name: String!, sold: Int!, revenue: Float! }
  type DashboardStatusCounts { delivered: Int!, processing: Int!, pending: Int!, cancelled: Int!, returned: Int! }
  type DashboardRecentOrder { id: ID!, orderNumber: String!, customerName: String!, productNames: [String!]!, amount: Float!, status: String!, date: String! }
  type DashboardInventoryAlert { id: ID!, name: String!, currentStock: Int!, threshold: Int!, status: String! }
  type AdminDashboard {
    stats: DashboardStatTotals!
    salesLast30Days: [DashboardPoint!]!
    salesByMonth: [DashboardPoint!]!
    revenueAnalytics: [DashboardRevenuePoint!]!
    customerGrowth: [DashboardCustomerPoint!]!
    topProducts: [DashboardTopProduct!]!
    statusCounts: DashboardStatusCounts!
    recentOrders: [DashboardRecentOrder!]!
    inventoryAlerts: [DashboardInventoryAlert!]!
  }

  input ProductVariantInput { id: ID, name: String!, sku: String!, attributes: String, price: Float!, compareAtPrice: Float, stock: Int!, lowStockAt: Int, isActive: Boolean }
  input ProductInput { name: String!, slug: String, sku: String, description: String, brand: String, price: Float!, compareAtPrice: Float, stock: Int, lowStockAt: Int, status: ProductStatus, isWholesale: Boolean, minWholesaleQty: Int, images: [String!], categoryId: ID!, variants: [ProductVariantInput!] }
  input ProductUpdateInput { name: String, slug: String, sku: String, description: String, brand: String, price: Float, compareAtPrice: Float, stock: Int, lowStockAt: Int, status: ProductStatus, isWholesale: Boolean, minWholesaleQty: Int, images: [String!], categoryId: ID, variants: [ProductVariantInput!] }
  input AddressInput { label: String, recipientName: String!, phone: String!, addressLine: String!, city: String!, area: String, postalCode: String, isDefault: Boolean }
  input AddressUpdateInput { label: String, recipientName: String, phone: String, addressLine: String, city: String, area: String, postalCode: String, isDefault: Boolean }

  type Query {
    me: User
    categories(includeInactive: Boolean): [Category!]!
    category(idOrSlug: String!): Category
    products(page: Int, limit: Int, search: String, categoryId: ID, status: ProductStatus, includeAll: Boolean): ProductPage!
    product(idOrSlug: String!): Product
    cart: Cart
    orders: [Order!]!
    order(id: ID!): Order
    addresses: [Address!]!
    wishlist: [WishlistItem!]!
    adminDashboard: AdminDashboard!
  }
  type Mutation {
    register(name: String!, email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    verifyEmail(email: String!, otp: String!): Boolean!
    logout: Boolean!
    createProduct(input: ProductInput!): Product!
    createProductVariant(productId: ID!, input: ProductVariantInput!): ProductVariant!
    updateProductVariant(id: ID!, input: ProductVariantInput!): ProductVariant!
    updateProduct(id: ID!, input: ProductUpdateInput!): Product!
    duplicateProduct(id: ID!): Product!
    archiveProduct(id: ID!): Product!
    deleteProduct(id: ID!): Boolean!
    createCategory(name: String!, description: String, image: String, isActive: Boolean): Category!
    updateCategory(id: ID!, name: String, description: String, image: String, isActive: Boolean): Category!
    deleteCategory(id: ID!): Boolean!
    addToCart(productId: ID!, variantId: ID, quantity: Int!): Cart
    removeFromCart(productId: ID!): Cart
    clearCart: Boolean!
    createAddress(input: AddressInput!): Address!
    updateAddress(id: ID!, input: AddressUpdateInput!): Address!
    deleteAddress(id: ID!): Boolean!
    createOrder(addressId: ID!, paymentMethod: PaymentMethod!, note: String): Order!
    payDemoOrder(orderId: ID!): Order!
    updateOrderStatus(id: ID!, status: OrderStatus, paymentStatus: PaymentStatus, courier: String, trackingNumber: String, note: String): Order!
    deleteOrder(id: ID!): Boolean!
    saveReview(productId: ID!, rating: Int!, comment: String): Review!
    deleteReview(id: ID!): Boolean!
    addToWishlist(productId: ID!): WishlistItem!
    removeFromWishlist(productId: ID!): Boolean!
  }
`;

const requireUser = (ctx: GraphQLContext) => {
  if (!ctx.user) {
    throw new GraphQLError("Authentication required", { extensions: { code: "UNAUTHENTICATED" } });
  }
  return ctx.user;
};
const isAdmin = (role: Role) => role === Role.ADMIN;
const requireAdmin = (ctx: GraphQLContext) => {
  const user = requireUser(ctx);
  if (!isAdmin(user.role)) {
    throw new GraphQLError("Admin access required", { extensions: { code: "FORBIDDEN" } });
  }
  return user;
};
const authPayload = (ctx: GraphQLContext, result: any) => {
  if (ctx.response) {
    if (result.accessToken) tokenUtils.setAccessTokenCookie(ctx.response, result.accessToken);
    if (result.refreshToken) tokenUtils.setRefreshTokenCookie(ctx.response, result.refreshToken);
    if (result.sessionCookie) tokenUtils.setBetterAuthSessionCookie(ctx.response, result.sessionCookie);
  }
  return {
    user: result.user,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    sessionCookie: result.sessionCookie,
  };
};
const number = (value: unknown) => (value == null ? null : Number(value));

export const schema = createSchema({
  typeDefs,
  resolvers: {
    DateTime: {
      serialize: (value: unknown) => new Date(value as string | number | Date).toISOString(),
    },
    Query: {
      me: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
        if (!ctx.user) return null;
        return AuthService.getMe(ctx.user.userId);
      },
      categories: (_: unknown, args: any) =>
        CategoryService.getAllCategories(Boolean(args.includeInactive)),
      category: (_: unknown, args: any) =>
        CategoryService.getCategoryById(args.idOrSlug).catch(() =>
          CategoryService.getCategoryBySlug(args.idOrSlug)
        ),
      products: (_: unknown, args: any, ctx: GraphQLContext) =>
        ProductService.list(args, Boolean(args.includeAll) || Boolean(ctx.user && isAdmin(ctx.user.role))),
      product: (_: unknown, args: any) => ProductService.get(args.idOrSlug),
      cart: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        CartService.get(requireUser(ctx).userId),
      orders: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        OrderService.list(requireUser(ctx).userId, isAdmin(requireUser(ctx).role)),
      order: (_: unknown, args: any, ctx: GraphQLContext) =>
        OrderService.get(args.id, requireUser(ctx).userId, isAdmin(requireUser(ctx).role)),
      addresses: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        AddressService.list(requireUser(ctx).userId),
      wishlist: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        WishlistService.list(requireUser(ctx).userId),
      adminDashboard: (_: unknown, __: unknown, ctx: GraphQLContext) => {
        requireAdmin(ctx);
        return AdminDashboardService.getOverview();
      },
    },
    Mutation: {
      register: async (_: unknown, args: any, ctx: GraphQLContext) =>
        authPayload(ctx, await AuthService.registerUSer(args)),
      login: async (_: unknown, args: any, ctx: GraphQLContext) =>
        authPayload(ctx, await AuthService.loginUser(args)),
      verifyEmail: async (_: unknown, args: any) => {
        await AuthService.verifyEmail(args.email, args.otp);
        return true;
      },
      logout: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
        await AuthService.logoutUser(ctx.sessionToken);
        if (ctx.response) {
          tokenUtils.clearAccessTokenCookie(ctx.response);
          tokenUtils.clearRefreshTokenCookie(ctx.response);
          tokenUtils.clearBetterAuthSessionCookie(ctx.response);
        }
        return true;
      },
      createProduct: (_: unknown, args: any, ctx: GraphQLContext) => {
        requireAdmin(ctx);
        return ProductService.create(args.input);
      },
      updateProduct: (_: unknown, args: any, ctx: GraphQLContext) => {
        requireAdmin(ctx);
        return ProductService.update(args.id, args.input);
      },
      duplicateProduct: (_: unknown, args: any, ctx: GraphQLContext) => {
        requireAdmin(ctx);
        return ProductService.duplicate(args.id);
      },
      archiveProduct: (_: unknown, args: any, ctx: GraphQLContext) => {
        requireAdmin(ctx);
        return ProductService.update(args.id, { status: "ARCHIVED" });
      },
      deleteProduct: async (_: unknown, args: any, ctx: GraphQLContext) => {
        requireAdmin(ctx);
        await ProductService.remove(args.id);
        return true;
      },
      createCategory: (_: unknown, args: any, ctx: GraphQLContext) => {
        requireAdmin(ctx);
        return CategoryService.createCategory(args);
      },
      updateCategory: (_: unknown, args: any, ctx: GraphQLContext) => {
        requireAdmin(ctx);
        const { id, ...rest } = args;
        return CategoryService.updateCategory(id, rest);
      },
      deleteCategory: async (_: unknown, args: any, ctx: GraphQLContext) => {
        requireAdmin(ctx);
        await CategoryService.deleteCategory(args.id);
        return true;
      },
      createProductVariant: (_: unknown, args: any, ctx: GraphQLContext) => {
        requireAdmin(ctx);
        return ProductService.createVariant(args.productId, args.input);
      },
      updateProductVariant: (_: unknown, args: any, ctx: GraphQLContext) => {
        requireAdmin(ctx);
        return ProductService.updateVariant(args.id, args.input);
      },
      addToCart: async (_: unknown, args: any, ctx: GraphQLContext) => {
        const user = requireUser(ctx);
        await CartService.upsert(user.userId, args.productId, args.quantity, args.variantId);
        return CartService.get(user.userId);
      },
      removeFromCart: async (_: unknown, args: any, ctx: GraphQLContext) => {
        const user = requireUser(ctx);
        await CartService.remove(user.userId, args.productId);
        return CartService.get(user.userId);
      },
      clearCart: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
        await CartService.clear(requireUser(ctx).userId);
        return true;
      },
      createAddress: (_: unknown, args: any, ctx: GraphQLContext) =>
        AddressService.create(requireUser(ctx).userId, args.input),
      updateAddress: (_: unknown, args: any, ctx: GraphQLContext) =>
        AddressService.update(requireUser(ctx).userId, args.id, args.input),
      deleteAddress: async (_: unknown, args: any, ctx: GraphQLContext) => {
        await AddressService.remove(requireUser(ctx).userId, args.id);
        return true;
      },
      createOrder: (_: unknown, args: any, ctx: GraphQLContext) =>
        OrderService.create(requireUser(ctx).userId, args),
      payDemoOrder: (_: unknown, args: any, ctx: GraphQLContext) =>
        PaymentService.payDemo(args.orderId, requireUser(ctx).userId),
      updateOrderStatus: (_: unknown, args: any, ctx: GraphQLContext) => {
        const admin = requireAdmin(ctx);
        const { id, ...rest } = args;
        return OrderService.updateStatus(id, rest, admin.userId);
      },
      deleteOrder: async (_: unknown, args: any, ctx: GraphQLContext) => {
        requireAdmin(ctx);
        await OrderService.remove(args.id);
        return true;
      },
      saveReview: (_: unknown, args: any, ctx: GraphQLContext) =>
        ReviewService.upsert(requireUser(ctx).userId, args),
      deleteReview: async (_: unknown, args: any, ctx: GraphQLContext) => {
        const user = requireUser(ctx);
        await ReviewService.remove(user.userId, args.id, isAdmin(user.role));
        return true;
      },
      addToWishlist: (_: unknown, args: any, ctx: GraphQLContext) =>
        WishlistService.add(requireUser(ctx).userId, args.productId),
      removeFromWishlist: async (_: unknown, args: any, ctx: GraphQLContext) => {
        await WishlistService.remove(requireUser(ctx).userId, args.productId);
        return true;
      },
    },
    Product: {
      price: (p: any) => number(p.price),
      compareAtPrice: (p: any) => number(p.compareAtPrice),
      variants: (p: any) => p.variants ?? [],
      reviews: (p: any) => p.reviews ?? [],
    },
    ProductVariant: {
      attributes: (v: any) =>
        typeof v.attributes === "string" ? v.attributes : JSON.stringify(v.attributes ?? {}),
      price: (v: any) => number(v.price),
      compareAtPrice: (v: any) => number(v.compareAtPrice),
    },
    Order: {
      subtotal: (o: any) => number(o.subtotal),
      deliveryFee: (o: any) => number(o.deliveryFee),
      discountAmount: (o: any) => number(o.discountAmount ?? 0),
      total: (o: any) => number(o.total),
    },
    OrderItem: { unitPrice: (i: any) => number(i.unitPrice) },
    Payment: { amount: (p: any) => number(p.amount) },
  },
});
