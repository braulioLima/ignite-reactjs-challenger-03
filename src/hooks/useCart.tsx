import { createContext, ReactNode, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { Product, Stock } from '../types';
import { formatedStorageKey } from '../util';

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
}

type ProductResponse = Omit<Product, 'amount'>;

interface CartContextData {
  cart: Product[];
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({ productId, amount }: UpdateProductAmount) => void;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [cart, setCart] = useState<Product[]>(() => {
    const key = formatedStorageKey('cart');
    const storagedCart = window.localStorage.getItem(key);

    if (storagedCart) {
      return JSON.parse(storagedCart);
    }

    return [];
  });

  const addProduct = async (productId: number) => {
    try {
      const productAlreadyInCart = cart.find(
        (product) => product.id === productId,
      );

      if (productAlreadyInCart) {
        const { data: stock, status: stockStatus } = await api.get<Stock>(
          `stock/${productId}`,
        );

        if (stockStatus === 404) {
          throw new Error();
        }

        if (stock.amount > productAlreadyInCart.amount) {
          const updatedCart = cart.map((product) =>
            product.id === productId
              ? { ...product, amount: product.amount + 1 }
              : product,
          );

          setCart(updatedCart);

          const key = formatedStorageKey('cart');

          window.localStorage.setItem(key, JSON.stringify(updatedCart));

          toast.success('Product added successfully');

          return;
        }

        toast.error('Quantidade solicitada fora de estoque');
        return;
      } else {
        const [
          { data: productData, status: productStatus },
          { data: stock, status: stockStatus },
        ] = await Promise.all([
          api.get<ProductResponse>(`products/${productId}`),
          api.get<Stock>(`stock/${productId}`),
        ]);

        if ((stockStatus || productStatus) === 404) {
          throw new Error();
        }

        if (stock.amount === 0) {
          toast.error('Quantidade solicitada fora de estoque');

          throw new Error();
        }

        const newProduct = { ...productData, amount: 1 };
        setCart([...cart, newProduct]);

        const key = formatedStorageKey('cart');

        window.localStorage.setItem(key, JSON.stringify([...cart, newProduct]));

        toast.success('Product added successfully');
        return;
      }
    } catch {
      toast.error('Erro na adição do produto');
    }
  };

  const removeProduct = (productId: number) => {
    try {
      const isProductInCart = cart.some((product) => product.id === productId);

      if (!isProductInCart) {
        throw new Error();
      }

      const updatedCart = cart.filter((product) => product.id !== productId);

      setCart(updatedCart);

      const key = formatedStorageKey('cart');

      window.localStorage.setItem(key, JSON.stringify(updatedCart));

      toast.success('Product removed successfully');
    } catch {
      toast.error('Erro na remoção do produto');
    }
  };

  const updateProductAmount = async ({
    productId,
    amount,
  }: UpdateProductAmount) => {
    try {
      const productInCart = cart.find((product) => product.id === productId);

      const { data: stock, status: stockStatus } = await api.get<Stock>(
        `stock/${productId}`,
      );

      if (!productInCart || stockStatus !== 200) {
        throw new Error();
      }

      if (amount <= 0 || stock.amount < amount) {
        toast.error('Quantidade solicitada fora de estoque');

        throw new Error();
      }

      const updatedCart = cart.map((product) =>
        product.id === productId ? { ...product, amount: amount } : product,
      );
      setCart(updatedCart);

      window.localStorage.setItem(
        formatedStorageKey('cart'),
        JSON.stringify(updatedCart),
      );

      toast.success('Product updated successfully');
    } catch {
      toast.error('Erro na alteração de quantidade do produto');
    }
  };

  return (
    <CartContext.Provider
      value={{ cart, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
