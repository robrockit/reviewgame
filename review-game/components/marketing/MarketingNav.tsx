'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

export default function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-200 ${
          scrolled ? 'shadow-sm' : ''
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Review Game
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main" className="hidden md:flex items-center gap-6">
            <Link
              href="/for-teachers"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              For Teachers
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Sign Up
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
            onClick={() => setMobileMenuOpen(true)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu-panel"
          >
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Mobile drawer — Dialog handles focus trap, Escape-to-close, and ARIA roles */}
      <Transition show={mobileMenuOpen}>
        <Dialog
          onClose={setMobileMenuOpen}
          className="relative z-50 md:hidden"
        >
          {/* Backdrop */}
          <TransitionChild
            enter="transition-opacity ease-linear duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/20" aria-hidden="true" />
          </TransitionChild>

          {/* Slide-down panel */}
          <TransitionChild
            enter="transition ease-in-out duration-200 transform"
            enterFrom="-translate-y-full"
            enterTo="translate-y-0"
            leave="transition ease-in-out duration-200 transform"
            leaveFrom="translate-y-0"
            leaveTo="-translate-y-full"
          >
            <DialogPanel
              id="mobile-menu-panel"
              className="fixed top-0 left-0 right-0 bg-white shadow-lg"
            >
              {/* Drawer header */}
              <div className="flex h-16 items-center justify-between px-4 border-b">
                <span className="text-xl font-bold text-blue-600">Review Game</span>
                <button
                  type="button"
                  className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="sr-only">Close menu</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>

              {/* Drawer links */}
              <nav aria-label="Mobile menu" className="px-4 py-4 flex flex-col gap-2">
                <Link
                  href="/for-teachers"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  For Teachers
                </Link>
                <Link
                  href="/pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Pricing
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full px-4 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors text-center"
                >
                  Sign Up
                </Link>
              </nav>
            </DialogPanel>
          </TransitionChild>
        </Dialog>
      </Transition>
    </>
  );
}
