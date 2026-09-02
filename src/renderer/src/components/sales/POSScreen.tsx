import React, { useState, useEffect, useRef } from "react";
import {
  Product,
  POSCartItem,
  PaymentMethod,
  Customer,
  Prescription,
  DiscountType,
  SalePayment,
} from "../../../../shared/types";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useNavigate, useLocation } from "react-router-dom";
import { CustomerForm } from "../customers/CustomerForm";

export const POSScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);

  // Initialize cart from localStorage if held
  const [isHeldRestored, setIsHeldRestored] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem("novo_held_cart");
    } catch (e) {
      return false;
    }
  });

  const [cart, setCart] = useState<POSCartItem[]>(() => {
    try {
      const held = localStorage.getItem("novo_held_cart");
      if (held) return JSON.parse(held);
    } catch (e) {}
    return [];
  });

  // Sync held cart changes to localStorage so deleted items do not reappear on route changes
  useEffect(() => {
    if (isHeldRestored) {
      if (cart.length === 0) {
        localStorage.removeItem("novo_held_cart");
        setIsHeldRestored(false);
      } else {
        localStorage.setItem("novo_held_cart", JSON.stringify(cart));
      }
    }
  }, [cart, isHeldRestored]);

  const [payments, setPayments] = useState<SalePayment[]>([
    { payment_method: "CASH", amount: 0 },
  ]);
  const [receivedAmount, setReceivedAmount] = useState<number | "">("");

  const [billDiscountType, setBillDiscountType] =
    useState<DiscountType>("NONE");
  const [billDiscountValue, setBillDiscountValue] = useState<number | "">("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  // Customer & Prescription state
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<
    Customer[]
  >([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [customerPrescriptions, setCustomerPrescriptions] = useState<
    Prescription[]
  >([]);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<
    number | null
  >(null);

  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const productContainerRef = useRef<HTMLDivElement>(null);
  const customerContainerRef = useRef<HTMLDivElement>(null);
  const customerSearchContainerRef = useRef<HTMLDivElement>(null);
  const processingLock = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-scroll selected product into view
  useEffect(() => {
    if (selectedResultIndex >= 0 && productContainerRef.current) {
      const activeElement =
        productContainerRef.current.querySelector(".active-product");
      if (activeElement) {
        activeElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedResultIndex]);

  // Auto-scroll selected customer into view
  useEffect(() => {
    if (selectedCustomerIndex >= 0 && customerContainerRef.current) {
      const activeElement =
        customerContainerRef.current.querySelector(".active-customer");
      if (activeElement) {
        activeElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedCustomerIndex]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        productContainerRef.current &&
        !productContainerRef.current.contains(event.target as Node)
      ) {
        setSearchResults([]);
      }
      if (
        customerSearchContainerRef.current &&
        !customerSearchContainerRef.current.contains(event.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Product Search Debounce
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        window.api.product
          .search(searchQuery)
          .then((results) => {
            setSearchResults(results);
            setSelectedResultIndex(-1);
          })
          .catch((err) => {
            setError(err.message || "Search failed");
          });
      } else {
        setSearchResults([]);
        setSelectedResultIndex(-1);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Customer Search Debounce
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      const query = customerSearchQuery.trim();
      window.api.customer
        .list({ page: 1, pageSize: 10, search: query || undefined })
        .then((results) => {
          setCustomerSearchResults(results.items);
          setSelectedCustomerIndex(-1);
        })
        .catch((err) => {
          console.error(err);
          setSelectedCustomerIndex(-1);
        });
    }, 150);

    return () => clearTimeout(delayDebounce);
  }, [customerSearchQuery]);

  const selectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearchQuery("");
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    setSelectedCustomerIndex(-1);
    setSelectedPrescriptionId(null);
    try {
      const result = await window.api.prescription.list(customer.id, 1, 50);
      setCustomerPrescriptions(result.items);
    } catch (e) {
      console.error(e);
    }
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerPrescriptions([]);
    setSelectedPrescriptionId(null);
  };

  const loadPrescription = async (prescription: Prescription) => {
    setSelectedPrescriptionId(prescription.id);
    setShowPrescriptionModal(false);

    // Add all linked products to cart
    let productsAdded = 0;
    let missingProducts = 0;

    for (const item of prescription.items || []) {
      if (item.product_id) {
        try {
          const product = await window.api.product.get(item.product_id);
          if (product && product.is_active) {
            const activeBatches = await window.api.inventory.getActiveBatches(
              product.id,
            );

            // Check if already in cart
            setCart((prev) => {
              const existing = prev.find((p) => p.product.id === product.id);
              if (existing) {
                return prev.map((p) =>
                  p.product.id === product.id
                    ? { ...p, quantity: p.quantity + item.quantity }
                    : p,
                );
              }
              return [
                ...prev,
                {
                  product,
                  quantity: item.quantity,
                  is_pack: false,
                  active_batches: activeBatches,
                  discount_type: "PERCENTAGE",
                  discount_value: 0,
                  is_price_overridden: false,
                },
              ];
            });
            productsAdded++;
          } else {
            missingProducts++;
          }
        } catch (e) {
          missingProducts++;
        }
      } else {
        missingProducts++;
      }
    }

    if (missingProducts > 0) {
      setError(
        `${productsAdded} items added. ${missingProducts} items were custom, inactive, or not found in the master. Please add them manually if needed.`,
      );
    } else {
      setError("");
    }
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (
      selectedResultIndex >= 0 &&
      selectedResultIndex < searchResults.length
    ) {
      addToCart(searchResults[selectedResultIndex]);
      return;
    }

    try {
      const results = await window.api.product.search(searchQuery);
      if (results.length === 1) {
        addToCart(results[0]);
        setSearchQuery("");
      } else {
        setSearchResults(results);
      }
    } catch (err: any) {
      setError(err.message || "Search failed");
    }
  };

  const addToCart = async (product: Product) => {
    setError("");
    if (!product.is_active) {
      setError(`Cannot add ${product.name} as it is inactive.`);
      return;
    }

    try {
      const activeBatches = await window.api.inventory.getActiveBatches(
        product.id,
      );

      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        } else {
          return [
            ...prev,
            {
              product,
              quantity: 1,
              is_pack: false,
              active_batches: activeBatches,
              discount_type: "PERCENTAGE",
              discount_value: 0,
              is_price_overridden: false,
            },
          ];
        }
      });

      setSearchQuery("");
      setSearchResults([]);
      setSelectedResultIndex(-1);
      searchInputRef.current?.focus();
    } catch (err: any) {
      setError("Failed to fetch batches: " + err.message);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      if (cart.length > 0) {
        e.preventDefault();
        // Focus the qty input of the last item added
        const qtyInputs = document.querySelectorAll(".qty-input");
        if (qtyInputs.length > 0) {
          const target = qtyInputs[qtyInputs.length - 1] as HTMLInputElement;
          target.focus();
          target.select();
        }
      }
    } else if (e.key === "ArrowDown") {
      if (searchResults.length > 0) {
        e.preventDefault();
        setSelectedResultIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev,
        );
      }
    } else if (e.key === "ArrowUp") {
      if (searchResults.length > 0) {
        e.preventDefault();
        setSelectedResultIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (customerSearchResults.length > 0) {
        e.preventDefault();
        setSelectedCustomerIndex((prev) =>
          prev < customerSearchResults.length - 1 ? prev + 1 : prev,
        );
      }
    } else if (e.key === "ArrowUp") {
      if (customerSearchResults.length > 0) {
        e.preventDefault();
        setSelectedCustomerIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    } else if (e.key === "Enter") {
      if (
        selectedCustomerIndex >= 0 &&
        selectedCustomerIndex < customerSearchResults.length
      ) {
        e.preventDefault();
        selectCustomer(customerSearchResults[selectedCustomerIndex]);
      }
    } else if (e.key === "Escape") {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      setSelectedCustomerIndex(-1);
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const newQuantity = item.quantity + delta;
          return { ...item, quantity: newQuantity > 0 ? newQuantity : 1 };
        }
        return item;
      }),
    );
  };

  const togglePack = (productId: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          return { ...item, is_pack: !item.is_pack };
        }
        return item;
      }),
    );
  };

  const changeCartItemBatch = (productId: number, batchId: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          return { ...item, selected_batch_id: batchId };
        }
        return item;
      }),
    );
  };

  const formatBatchExpiry = (timestamp: number | undefined) => {
    if (!timestamp) return "N/A";
    const d = new Date(timestamp);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${month}/${year}`;
  };

  const updateDiscount = (
    productId: number,
    type: DiscountType,
    value: number,
  ) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          return { ...item, discount_type: type, discount_value: value };
        }
        return item;
      }),
    );
  };

  const updateOverride = (productId: number, overriddenPrice: number | "") => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          if (overriddenPrice === "") {
            return {
              ...item,
              is_price_overridden: false,
              overridden_price: undefined,
            };
          } else {
            return {
              ...item,
              is_price_overridden: true,
              overridden_price: Math.round(Number(overriddenPrice) * 100),
            };
          }
        }
        return item;
      }),
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleHoldSale = () => {
    if (cart.length > 0) {
      localStorage.setItem("novo_held_cart", JSON.stringify(cart));
      setIsHeldRestored(false);
      setCart([]);
      setPayments([{ payment_method: "CASH", amount: 0 }]);
      setBillDiscountType("NONE");
      setBillDiscountValue("");
      clearCustomer();
      setError(
        "Cart held successfully. Press F2 to restore it, or F1 to start a new sale.",
      );
    } else {
      const held = localStorage.getItem("novo_held_cart");
      if (held) {
        setCart(JSON.parse(held));
        setIsHeldRestored(true);
        setError("Restored held sale.");
      } else {
        setError("No held sale found.");
      }
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || processingLock.current) return;

    // Check prescriptions
    const needsPrescription = cart.some(
      (item) => item.product.prescription_required,
    );
    if (
      needsPrescription &&
      !selectedPrescriptionId &&
      !window.confirm(
        "Some items require a prescription. Do you want to proceed without attaching one (Pharmacist Override)?",
      )
    ) {
      return;
    }

    processingLock.current = true;
    setIsProcessing(true);
    setError("");

    try {
      // Clean payments
      const finalPayments = payments
        .map((p) => ({ ...p, amount: Math.round(Number(p.amount) * 100) }))
        .filter((p) => p.amount > 0);
      if (finalPayments.length === 0) {
        // Auto-fill cash if empty
        finalPayments.push({ payment_method: "CASH", amount: cartGrandTotal });
      }

      const payload = {
        payment_method:
          finalPayments.length > 0 ? finalPayments[0].payment_method : "CASH",
        payments: finalPayments,
        received_amount: receivedAmount
          ? Math.round(Number(receivedAmount) * 100)
          : undefined,
        bill_discount_type:
          billDiscountType === "NONE" ? undefined : billDiscountType,
        bill_discount_value: billDiscountValue
          ? Math.round(
              Number(billDiscountValue) *
                (billDiscountType === "FIXED" ? 100 : 1),
            )
          : undefined,
        customer_id: selectedCustomer?.id || null,
        prescription_id: selectedPrescriptionId || null,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          is_pack: item.is_pack,
          discount_type:
            item.discount_type === "NONE" ? undefined : item.discount_type,
          discount_value: item.discount_value
            ? item.discount_type === "FIXED"
              ? Math.round(item.discount_value * 100)
              : item.discount_value
            : undefined,
          is_price_overridden: item.is_price_overridden,
          overridden_price: item.overridden_price,
          selected_batch_id: item.selected_batch_id,
        })),
      };

      const sale = await window.api.sale.create(payload);
      if (isHeldRestored) {
        localStorage.removeItem("novo_held_cart"); // clear held cart ONLY if this sale was the restored held cart
        setIsHeldRestored(false);
      }
      navigate(`/sales/invoice/${sale.invoice_number}`, {
        state: { isNewSale: true },
      });
    } catch (err: any) {
      setError(err.message || "Checkout failed");
      processingLock.current = false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle shortcuts forwarded from other screens via location state
  useEffect(() => {
    if (location.state && (location.state as any).triggerShortcut) {
      const shortcut = (location.state as any).triggerShortcut;
      // Silently clear history state without triggering a React Router route replace re-mount
      try {
        window.history.replaceState({}, document.title);
      } catch (e) {}

      if (shortcut === "F1") {
        setCart([]);
        setIsHeldRestored(false);
        setPayments([{ payment_method: "CASH", amount: 0 }]);
        setBillDiscountType("NONE");
        setBillDiscountValue("");
        clearCustomer();
        setSearchQuery("");
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      } else if (shortcut === "F2") {
        handleHoldSale();
      } else if (shortcut === "F8") {
        if (cart.length > 0 && !isProcessing) {
          handleCheckout();
        }
      }
    }
  }, [location.state]);

  // Derived Totals
  const getCartItemBasePrices = (item: POSCartItem) => {
    const targetBatch =
      item.active_batches && item.active_batches.length > 0
        ? item.selected_batch_id
          ? item.active_batches.find((b) => b.id === item.selected_batch_id) ||
            item.active_batches[0]
          : item.active_batches[0]
        : null;

    const originalSellingPrice = targetBatch
      ? targetBatch.selling_price > 0
        ? targetBatch.selling_price
        : item.product.selling_price
      : item.product.selling_price;
    const mrp = targetBatch
      ? targetBatch.mrp > 0
        ? targetBatch.mrp
        : item.product.selling_price
      : item.product.selling_price;

    const multiplier = item.is_pack ? item.product.units_per_pack || 1 : 1;

    return {
      mrp: mrp * multiplier,
      originalRate: originalSellingPrice * multiplier,
      rate:
        item.is_price_overridden && item.overridden_price !== undefined
          ? item.overridden_price
          : originalSellingPrice * multiplier,
    };
  };

  let cartSubtotal = 0; // Inclusive of tax before discount
  let cartTotalItemDiscount = 0;
  let cartGrossTaxable = 0; // Line total after line discount, before bill discount
  let cartTotalTax = 0; // Exact tax will be estimated here, backend is authoritative

  const enhancedCart = cart.map((item) => {
    const prices = getCartItemBasePrices(item);
    const lineGross = prices.rate * item.quantity;

    let discountAmt = 0;
    if (item.discount_type === "PERCENTAGE" && item.discount_value) {
      discountAmt = Math.round((lineGross * item.discount_value) / 100);
    } else if (item.discount_type === "FIXED" && item.discount_value) {
      discountAmt = Math.round(item.discount_value * 100);
    }

    const lineTotalAfterDiscount = lineGross - discountAmt;

    cartSubtotal += lineGross;
    cartTotalItemDiscount += discountAmt;
    cartGrossTaxable += lineTotalAfterDiscount;

    return { ...item, prices, lineGross, lineTotalAfterDiscount, discountAmt };
  });

  let billDiscountAmt = 0;
  if (billDiscountType === "PERCENTAGE" && billDiscountValue) {
    billDiscountAmt = Math.round(
      (cartGrossTaxable * Number(billDiscountValue)) / 100,
    );
  } else if (billDiscountType === "FIXED" && billDiscountValue) {
    billDiscountAmt = Math.round(Number(billDiscountValue) * 100);
  }

  const cartGrandTotal = cartGrossTaxable - billDiscountAmt;

  // Estimate Tax
  enhancedCart.forEach((item) => {
    let apportionedBillDiscount = 0;
    if (billDiscountAmt > 0 && cartGrossTaxable > 0) {
      apportionedBillDiscount = Math.round(
        (item.lineTotalAfterDiscount / cartGrossTaxable) * billDiscountAmt,
      );
    }
    const finalTaxable = item.lineTotalAfterDiscount - apportionedBillDiscount;
    const tax = Math.round(
      (finalTaxable * item.product.tax_rate) / (10000 + item.product.tax_rate),
    );
    cartTotalTax += tax;
  });

  const cartNetSubtotal = cartGrandTotal - cartTotalTax; // Exclusive of tax

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setCart([]);
        setIsHeldRestored(false);
        setPayments([{ payment_method: "CASH", amount: 0 }]);
        setBillDiscountType("NONE");
        setBillDiscountValue("");
        clearCustomer();
        setSearchQuery("");
        searchInputRef.current?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        handleHoldSale();
      } else if (e.key === "F8") {
        e.preventDefault();
        if (cart.length > 0 && !isProcessing) {
          handleCheckout();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    cart,
    isProcessing,
    payments,
    selectedCustomer,
    selectedPrescriptionId,
    billDiscountType,
    billDiscountValue,
    receivedAmount,
  ]);

  const handleAddPayment = () => {
    setPayments([...payments, { payment_method: "UPI", amount: 0 }]);
  };

  const updatePayment = (index: number, field: string, value: string) => {
    const newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], [field]: value };
    setPayments(newPayments);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const paymentTotal = payments.reduce(
    (sum, p) => sum + Math.round(Number(p.amount) * 100),
    0,
  );
  const isPaymentValid = paymentTotal >= cartGrandTotal || paymentTotal === 0; // If 0, we auto-fill cash

  return (
    <div className="font-sans max-w-[1600px] mx-auto h-full flex flex-col space-y-4">
      {/* Custom Header */}
      <div className="flex justify-between items-center bg-white p-3 rounded-sm border border-slate-300 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-sm bg-teal-50 flex items-center justify-center text-teal-600">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-none">
              Point of Sale
            </h1>
            <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
              Quick and easy billing for your customers
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="text-amber-700 border-amber-200 bg-amber-50 text-xs font-bold"
            onClick={handleHoldSale}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            F2 - Hold Sale
          </Button>
          <Button
            variant="outline"
            className="text-teal-700 border-teal-200 bg-teal-50 text-xs font-bold"
            onClick={() => {
              setCart([]);
              clearCustomer();
              setIsHeldRestored(false);
            }}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            F1 - New Sale
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start shrink-0 shadow-sm">
          <svg
            className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-red-800 font-bold">{error}</p>
        </div>
      )}

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* Left Side: Cart Table & Search */}
        <div className="lg:col-span-8 flex flex-col bg-white rounded-sm border border-slate-300 overflow-hidden min-h-0">
          {/* Top Bar of Left Side: Search */}
          <div className="p-3 border-b border-slate-200 flex items-center space-x-2 bg-slate-50/50">
            <div className="flex-1 relative">
              <form onSubmit={handleBarcodeSubmit}>
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search by medicine name, generic name or barcode..."
                  className="w-full bg-white shadow-sm font-medium"
                  icon={
                    <svg
                      className="h-4 w-4 text-teal-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  }
                />
              </form>

              {/* Absolute Dropdown for Search Results */}
              {searchResults.length > 0 && (
                <div
                  ref={productContainerRef}
                  className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-80 overflow-y-auto z-50"
                >
                  {searchResults.map((product, index) => (
                    <div
                      key={product.id}
                      className={`p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center transition-colors ${selectedResultIndex === index ? "bg-teal-50 ring-inset ring-2 ring-teal-500/20 active-product" : ""}`}
                      onClick={() => addToCart(product)}
                    >
                      <div>
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          {product.name}
                          {product.prescription_required === 1 && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase">
                              Rx
                            </span>
                          )}
                          {!product.is_active && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {product.generic_name} • {product.strength}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-teal-700">
                          ₹{(product.selling_price / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart Table */}
          <div className="flex-1 overflow-y-auto bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-xs font-semibold text-slate-600 sticky top-0 border-b border-slate-300 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-2 font-semibold w-8 text-center border-r border-slate-200">
                    #
                  </th>
                  <th className="px-3 py-2 font-semibold border-r border-slate-200 min-w-[150px]">
                    Medicine
                  </th>
                  <th className="px-3 py-2 font-semibold border-r border-slate-200 w-24">
                    Unit
                  </th>
                  <th className="px-3 py-2 font-semibold text-right border-r border-slate-200 w-20">
                    MRP
                  </th>
                  <th className="px-3 py-2 font-semibold text-right border-r border-slate-200 w-24">
                    Rate
                  </th>
                  <th className="px-3 py-2 font-semibold text-center border-r border-slate-200 w-28">
                    Qty
                  </th>
                  <th className="px-3 py-2 font-semibold text-center border-r border-slate-200 w-28">
                    Discount
                  </th>
                  <th className="px-3 py-2 font-semibold text-right border-r border-slate-200 w-24">
                    Total
                  </th>
                  <th className="px-3 py-2 font-semibold text-center w-10">
                    Act
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {enhancedCart.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-12 text-center text-slate-400"
                    >
                      Cart is empty. Search for a medicine to add.
                    </td>
                  </tr>
                ) : (
                  enhancedCart.map((item, index) => (
                    <tr
                      key={item.product.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-2 py-3 text-center text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>{item.product.name}</span>
                          {item.product.prescription_required === 1 && (
                            <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1 py-0.5 rounded uppercase">
                              Rx
                            </span>
                          )}
                        </div>

                        {/* Batch Display & Selection Dropdown */}
                        <div className="mt-1">
                          {item.active_batches &&
                          item.active_batches.length > 0 ? (
                            item.active_batches.length === 1 ? (
                              <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                                <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-700">
                                  Batch:{" "}
                                  <strong className="text-slate-900">
                                    {item.active_batches[0].batch_number}
                                  </strong>
                                </span>
                                <span className="text-slate-400 font-mono text-[10px]">
                                  Exp:{" "}
                                  {formatBatchExpiry(
                                    item.active_batches[0].expiry_date,
                                  )}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-teal-700 font-bold uppercase">
                                  Batch:
                                </span>
                                <select
                                  value={
                                    item.selected_batch_id ||
                                    item.active_batches[0].id
                                  }
                                  onChange={(e) =>
                                    changeCartItemBatch(
                                      item.product.id,
                                      Number(e.target.value),
                                    )
                                  }
                                  className="text-[11px] font-semibold text-teal-900 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer max-w-[220px] truncate"
                                >
                                  {item.active_batches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.batch_number} (Exp:{" "}
                                      {formatBatchExpiry(b.expiry_date)}) • Stk:{" "}
                                      {b.quantity}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )
                          ) : (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded inline-block">
                              No Active Batch
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        {item.product.pack_type &&
                        (item.product.units_per_pack || 0) > 1 ? (
                          <select
                            value={item.is_pack ? "pack" : "unit"}
                            onChange={() => togglePack(item.product.id)}
                            className="bg-transparent text-xs border border-slate-300 rounded px-1 py-1 w-full focus:outline-none focus:border-teal-500"
                          >
                            <option value="unit">
                              {item.product.unit || "Unit"}
                            </option>
                            <option value="pack">
                              {item.product.pack_type}
                            </option>
                          </select>
                        ) : (
                          <span className="text-slate-500">
                            {item.product.unit || "Unit"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-500">
                        ₹{(item.prices.mrp / 100).toFixed(2)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className="relative group">
                          {item.is_price_overridden ? (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] line-through text-slate-400">
                                ₹{(item.prices.originalRate / 100).toFixed(2)}
                              </span>
                              <Input
                                type="number"
                                className="w-16 h-7 text-right px-1 py-0 text-xs font-bold text-amber-700 bg-amber-50 border-amber-200"
                                value={
                                  item.overridden_price !== undefined
                                    ? item.overridden_price / 100
                                    : ""
                                }
                                onChange={(e) =>
                                  updateOverride(
                                    item.product.id,
                                    e.target.value === ""
                                      ? ""
                                      : Number(e.target.value),
                                  )
                                }
                                placeholder="0.00"
                              />
                            </div>
                          ) : (
                            <div
                              className="font-bold text-slate-900 cursor-pointer hover:text-teal-600 border-b border-dashed border-transparent hover:border-teal-400"
                              onClick={() =>
                                updateOverride(
                                  item.product.id,
                                  item.prices.originalRate / 100,
                                )
                              }
                              title="Click to override rate"
                            >
                              ₹{(item.prices.rate / 100).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-6 h-6 flex items-center justify-center border border-slate-200 rounded-l text-slate-500 hover:bg-slate-100"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            className="w-10 h-6 text-center text-xs font-bold border-y border-slate-200 focus:outline-none focus:border-teal-500 qty-input"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (val > 0) {
                                setCart((prev) =>
                                  prev.map((p) =>
                                    p.product.id === item.product.id
                                      ? { ...p, quantity: val }
                                      : p,
                                  ),
                                );
                              }
                            }}
                            placeholder="0"
                          />
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="w-6 h-6 flex items-center justify-center border border-slate-200 rounded-r text-slate-500 hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex border border-slate-300 rounded overflow-hidden h-7">
                          <select
                            className="bg-slate-50 text-[10px] px-1 border-r border-slate-200 outline-none w-10 text-center"
                            value={item.discount_type || "NONE"}
                            onChange={(e) =>
                              updateDiscount(
                                item.product.id,
                                e.target.value as DiscountType,
                                item.discount_value || 0,
                              )
                            }
                          >
                            <option value="NONE">-</option>
                            <option value="PERCENTAGE">%</option>
                            <option value="FIXED">₹</option>
                          </select>
                          <input
                            type="number"
                            className="w-full text-right px-1 text-xs outline-none"
                            disabled={
                              !item.discount_type ||
                              item.discount_type === "NONE"
                            }
                            value={item.discount_value || ""}
                            onChange={(e) =>
                              updateDiscount(
                                item.product.id,
                                item.discount_type || "NONE",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            placeholder="0"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-teal-700">
                        ₹{(item.lineTotalAfterDiscount / 100).toFixed(2)}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Shortcuts */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-center space-x-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="flex items-center">
              <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-700 mr-2 shadow-sm">
                F1
              </span>{" "}
              New
            </div>
            <div className="flex items-center">
              <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-700 mr-2 shadow-sm">
                F2
              </span>{" "}
              Hold
            </div>
            <div className="flex items-center">
              <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-700 mr-2 shadow-sm">
                F8
              </span>{" "}
              Complete
            </div>
          </div>
        </div>

        {/* Right Side: Customer & Bill Summary */}
        <div className="lg:col-span-4 flex flex-col space-y-4 min-h-0">
          {/* Customer Details Block */}
          <div className="bg-white rounded-sm border border-slate-300 flex flex-col shrink-0 relative z-40">
            <div className="p-2 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-semibold text-sm text-slate-800 flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-teal-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Customer Details
              </h3>
              <div className="flex items-center space-x-2">
                {!selectedCustomer && (
                  <button
                    onClick={() => setShowNewCustomerModal(true)}
                    className="text-[10px] font-bold text-teal-600 border border-teal-200 bg-teal-50 px-2 py-1 rounded hover:bg-teal-100 shadow-sm transition-colors uppercase flex items-center"
                  >
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    New
                  </button>
                )}
                {selectedCustomer && (
                  <button
                    onClick={clearCustomer}
                    className="text-[10px] font-bold text-slate-400 border border-slate-200 bg-white px-2 py-1 rounded hover:text-slate-700 shadow-sm transition-colors uppercase"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="p-4">
              {!selectedCustomer ? (
                <div ref={customerSearchContainerRef} className="relative">
                  <Input
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onKeyDown={handleCustomerKeyDown}
                    onFocus={() => {
                      setShowCustomerDropdown(true);
                      const query = customerSearchQuery.trim();
                      window.api.customer
                        .list({
                          page: 1,
                          pageSize: 10,
                          search: query || undefined,
                        })
                        .then((results) => {
                          setCustomerSearchResults(results.items);
                          setSelectedCustomerIndex(-1);
                        })
                        .catch(console.error);
                    }}
                    onClick={() => setShowCustomerDropdown(true)}
                    placeholder="Search customer name or phone..."
                    className="bg-white text-sm cursor-pointer"
                  />
                  {showCustomerDropdown && customerSearchResults.length > 0 && (
                    <div
                      ref={customerContainerRef}
                      className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto z-50"
                    >
                      {customerSearchResults.map((c, index) => (
                        <div
                          key={c.id}
                          className={`px-3 py-2 cursor-pointer border-b border-slate-50 text-sm transition-colors ${
                            index === selectedCustomerIndex
                              ? "bg-teal-50 font-semibold shadow-sm active-customer"
                              : "hover:bg-teal-50"
                          }`}
                          onClick={() => selectCustomer(c)}
                        >
                          <div className="font-bold text-slate-800">
                            {c.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {c.phone}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center text-sm">
                      <span className="w-16 text-slate-500 font-medium">
                        Name
                      </span>
                      <span className="font-bold text-slate-900">
                        {selectedCustomer.name}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="w-16 text-slate-500 font-medium">
                        Phone
                      </span>
                      <span className="font-bold text-slate-900">
                        {selectedCustomer.phone}
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full border-2 border-slate-100 flex items-center justify-center bg-slate-50 text-slate-400">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                </div>
              )}

              {/* Prescriptions */}
              {selectedCustomer && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <Button
                    variant="outline"
                    className="w-full text-xs font-bold border-slate-200"
                    onClick={() => setShowPrescriptionModal(true)}
                  >
                    {selectedPrescriptionId
                      ? "Change Prescription"
                      : "Select Prescription"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Bill Summary Block */}
          <div className="bg-white rounded-sm border border-slate-300 flex flex-col flex-1 min-h-0 overflow-y-auto">
            <div className="p-2 border-b border-slate-200 bg-slate-50/50 sticky top-0 z-10">
              <h3 className="font-semibold text-sm text-slate-800 flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-teal-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Bill Summary
              </h3>
            </div>

            <div className="p-4 flex flex-col space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Gross Amount</span>
                <span className="font-medium text-slate-800">
                  ₹{(cartSubtotal / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-teal-700">
                <span className="text-teal-600">Item Discounts</span>
                <span className="font-medium">
                  - ₹{(cartTotalItemDiscount / 100).toFixed(2)}
                </span>
              </div>

              {/* Bill Discount Input */}
              <div className="flex justify-between items-center py-2 border-y border-slate-100 my-1">
                <span className="text-slate-500">Bill Discount</span>
                <div className="flex border border-slate-300 rounded overflow-hidden h-7 w-32">
                  <select
                    className="bg-slate-50 text-[10px] px-1 border-r border-slate-200 outline-none w-10 text-center"
                    value={billDiscountType}
                    onChange={(e) =>
                      setBillDiscountType(e.target.value as DiscountType)
                    }
                  >
                    <option value="NONE">-</option>
                    <option value="PERCENTAGE">%</option>
                    <option value="FIXED">₹</option>
                  </select>
                  <input
                    type="number"
                    className="w-full text-right px-2 text-xs outline-none"
                    disabled={billDiscountType === "NONE"}
                    value={billDiscountValue}
                    onChange={(e) =>
                      setBillDiscountValue(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">Net Taxable</span>
                <span className="font-medium text-slate-800">
                  ₹{(cartNetSubtotal / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Tax</span>
                <span className="font-medium text-slate-800">
                  ₹{(cartTotalTax / 100).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-end pt-3 pb-1">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  Grand Total
                </span>
                <span className="text-3xl font-black text-teal-600 tracking-tight">
                  ₹{(cartGrandTotal / 100).toFixed(2)}
                </span>
              </div>

              {/* Split Payment Section */}
              <div className="mt-4 border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Payment
                  </h4>
                  <div className="flex items-center space-x-3">
                    <label className="flex items-center space-x-1.5 cursor-pointer bg-teal-50 px-2 py-1 rounded border border-teal-100 hover:bg-teal-100 transition-colors">
                      <input
                        type="checkbox"
                        className="w-3 h-3 text-teal-600 rounded border-teal-300 focus:ring-teal-500 cursor-pointer"
                        checked={
                          payments.length === 1 &&
                          Number(payments[0].amount) === cartGrandTotal / 100
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPayments([
                              {
                                payment_method:
                                  payments[0]?.payment_method || "CASH",
                                amount: cartGrandTotal / 100,
                              },
                            ]);
                          } else {
                            setPayments([
                              {
                                payment_method:
                                  payments[0]?.payment_method || "CASH",
                                amount: 0,
                              },
                            ]);
                          }
                        }}
                        placeholder="Enter value..."
                      />
                      <span className="text-[10px] text-teal-700 font-bold uppercase">
                        Paid in Full
                      </span>
                    </label>
                    <button
                      onClick={handleAddPayment}
                      className="text-[10px] bg-white border border-slate-300 px-2 py-1 rounded text-slate-600 hover:bg-slate-100"
                    >
                      + Add Split
                    </button>
                  </div>
                </div>

                {payments.map((p, index) => (
                  <div key={index} className="flex space-x-2 mb-2 items-center">
                    <select
                      value={p.payment_method}
                      onChange={(e) =>
                        updatePayment(index, "payment_method", e.target.value)
                      }
                      className="bg-white border border-slate-300 text-xs rounded px-2 py-1.5 w-24 outline-none"
                    >
                      <option value="CASH">CASH</option>
                      <option value="CARD">CARD</option>
                      <option value="UPI">UPI</option>
                    </select>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={p.amount || ""}
                      onChange={(e) =>
                        updatePayment(index, "amount", e.target.value)
                      }
                      className="flex-1 text-xs h-7 min-h-7 py-0 bg-white text-right"
                    />
                    {payments.length > 1 && (
                      <button
                        onClick={() => removePayment(index)}
                        className="text-red-400 p-1"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}

                <div className="flex justify-between text-xs mt-3 pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Paid Amount</span>
                  <span
                    className={`font-bold ${!isPaymentValid ? "text-red-500" : "text-slate-700"}`}
                  >
                    ₹{(paymentTotal / 100).toFixed(2)}
                  </span>
                </div>

                {payments.some((p) => p.payment_method === "CASH") && (
                  <div className="flex justify-between items-center text-xs mt-2 bg-amber-50 p-2 rounded border border-amber-100">
                    <span className="text-amber-800 font-medium">
                      Cash Received
                    </span>
                    <input
                      type="number"
                      value={receivedAmount}
                      onChange={(e) =>
                        setReceivedAmount(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      placeholder="Customer gave..."
                      className="w-24 text-right px-2 py-1 rounded border border-amber-200 text-amber-900 outline-none"
                    />
                  </div>
                )}
              </div>

              <Button
                className="w-full h-10 text-[15px] font-bold mt-4 shadow-none flex justify-between items-center px-4"
                disabled={
                  cart.length === 0 || (!isPaymentValid && paymentTotal > 0)
                }
                isLoading={isProcessing}
                onClick={handleCheckout}
              >
                <span className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  Complete Sale
                </span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-teal-50">
                  (F8)
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Prescription Modal */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Select Prescription
                </h2>
                <p className="text-sm text-slate-500">
                  For {selectedCustomer?.name}
                </p>
              </div>
              <button
                onClick={() => setShowPrescriptionModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {customerPrescriptions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p>No prescriptions found for this customer.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {customerPrescriptions.map((p) => (
                    <div
                      key={p.id}
                      className={`bg-white border rounded-lg p-4 cursor-pointer transition-all ${selectedPrescriptionId === p.id ? "border-teal-500 shadow-md ring-1 ring-teal-500 bg-teal-50/10" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"}`}
                      onClick={() => loadPrescription(p)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-bold text-slate-800">
                            {p.doctor_name}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">
                            {new Date(p.prescription_date).toLocaleDateString()}{" "}
                            {p.reference_number &&
                              `• Ref: ${p.reference_number}`}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-teal-200 text-teal-700 bg-teal-50"
                        >
                          Select & Load
                        </Button>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm">
                        <ul className="space-y-2">
                          {p.items?.map((item) => (
                            <li
                              key={item.id}
                              className="flex justify-between text-slate-700 items-center"
                            >
                              <span className="font-medium">
                                • {item.medicine_name_snapshot}{" "}
                                <span className="text-slate-400 text-xs ml-1 font-normal bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  {item.dosage_instructions}
                                </span>
                              </span>
                              <span className="font-bold text-slate-800 bg-slate-200/50 px-2 py-0.5 rounded text-xs">
                                Qty: {item.quantity}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">New Customer</h2>
              <button
                onClick={() => setShowNewCustomerModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <CustomerForm
                onSuccess={() => setShowNewCustomerModal(false)}
                onCancel={() => setShowNewCustomerModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
