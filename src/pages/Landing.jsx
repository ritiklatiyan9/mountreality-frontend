import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import HeroSection from '../components/ui/hero-section';

export const Landing = () => {
  return (
    <div className="min-h-screen w-full bg-background scroll-smooth relative overflow-x-hidden">
      <HeroSection />

      <footer className="border-t border-border bg-background py-6 sm:py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 sm:w-6 h-5 sm:h-6 rounded bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
              <Building2 className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-primary-foreground" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-foreground">Mount Reality</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5 text-xs text-muted-foreground">
            <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link to="/signup" className="hover:text-foreground transition-colors">Sign Up</Link>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Mount Reality. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
