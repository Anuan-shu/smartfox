import React from 'react';
import { render } from '@testing-library/react';
import { ConfigProvider } from 'antd';

const AllTheProviders = ({ children }) => {
  return (
    <ConfigProvider>
      {children}
    </ConfigProvider>
  );
};

const customRender = (ui, options) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };