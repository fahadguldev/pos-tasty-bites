import { Outlet } from 'react-router-dom';
import { CartDrawer } from '../../components/store/CartDrawer';
import { OrderBar } from '../../components/store/OrderBar';
import { StoreFooter, StoreHeader } from '../../components/store/StoreShell';
import { useSettings } from '../../components/store/storeSettings';

export default function StoreLayout() {
  const settings = useSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <StoreHeader settings={settings} />
      {/* Clears the fixed order bar on phones. The bar is ~85px tall (more when
          the cart-subtotal line shows) and grows again on phones with a home
          indicator, so the clearance tracks the same inset instead of guessing. */}
      <main className="flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] sm:pb-0">
        <Outlet context={settings} />
      </main>
      <StoreFooter settings={settings} />
      <CartDrawer settings={settings} />
      <OrderBar settings={settings} />
    </div>
  );
}
