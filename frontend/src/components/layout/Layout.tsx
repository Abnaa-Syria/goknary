import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import AnnouncementBar from './AnnouncementBar';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="print:hidden">
        <AnnouncementBar />
        <Header />
      </div>
      <main className="flex-grow">
        <Outlet />
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
};

export default Layout;

