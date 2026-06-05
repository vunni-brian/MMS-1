import { useNavigate } from "react-router-dom";
import {
 ArrowRight,
 BarChart3,
 Bell,
 CheckCircle2,
 CreditCard,
 Landmark,
 MessageSquareText,
 Search,
 ShieldCheck,
 Store,
 Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const publicLinks = [
 { label: "Home", target: "home" },
 { label: "Services", target: "services" },
 { label: "Departments", target: "departments" },
 { label: "Help & Support", target: "support" },
];

const topServices = [
 {
 title: "Vendor Registration",
 detail: "Apply for a new vendor permit or renew an existing one.",
 icon: Store,
 link: "/register"
 },
 {
 title: "Pay Market Dues",
 detail: "Settle your monthly stall fees, utilities, and penalties.",
 icon: CreditCard,
 link: "/login"
 },
 {
 title: "Lodge a Complaint",
 detail: "Report maintenance issues, disputes, or hygiene concerns.",
 icon: MessageSquareText,
 link: "/login"
 },
 {
 title: "Official Portal",
 detail: "Staff login for managers, administrators, and officials.",
 icon: Users,
 link: "/login"
 },
];

const departments = [
 { title: "Revenue & Billing", detail: "Manage revenue streams and financial compliance.", icon: BarChart3 },
 { title: "Operations", detail: "Stall allocation, vendor management, and daily workflows.", icon: Landmark },
 { title: "Security & Audit", detail: "Access control, compliance monitoring, and incident logs.", icon: ShieldCheck },
 { title: "Communications", detail: "Public notices, vendor alerts, and general announcements.", icon: Bell },
];

const Index = () => {
 const navigate = useNavigate();

 return (
 <div className="min-h-screen bg-[#F3F4F6] text-slate-900 font-sans">
 {/* Official Top Bar */}
 <div className="bg-primary px-4 py-2 text-white sm:px-6 lg:px-8">
 <div className="mx-auto flex max-w-7xl items-center justify-between text-xs font-medium">
 <div className="flex items-center gap-2">
 <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-primary">✓</span>
 Official Market Management Portal
 </div>
 <div className="hidden sm:flex gap-4">
 <a href="#" className="hover:underline">English</a>
 <a href="#" className="hover:underline">Luganda</a>
 <a href="#" className="hover:underline">Swahili</a>
 </div>
 </div>
 </div>

 <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white shadow-sm">
 <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
 <button
 type="button"
 onClick={() => navigate("/")}
 className="flex items-center gap-4 focus-visible:outline-none"
 aria-label="MMS home"
 >
 <div className="flex h-12 w-12 items-center justify-center bg-primary text-white">
 <Landmark className="h-6 w-6" />
 </div>
 <div className="text-left">
 <span className="block text-xl font-bold leading-tight text-slate-900 tracking-tight">KAMPALA MARKETS</span>
 <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Management System</span>
 </div>
 </button>

 <nav className="hidden items-center gap-8 text-sm font-bold text-slate-700 md:flex">
 {publicLinks.map((item) => (
 <a key={item.label} href={`#${item.target}`} className="hover:text-primary transition-colors">
 {item.label}
 </a>
 ))}
 </nav>

 <div className="flex items-center gap-3">
 <Button variant="outline" size="sm" onClick={() => navigate("/login")} className="hidden sm:flex font-bold border-slate-300 rounded-sm hover:bg-slate-50">
 Sign In
 </Button>
 <Button size="sm" className="font-bold bg-warning text-slate-900 hover:bg-warning/90 rounded-sm shadow-none" onClick={() => navigate("/register")}>
 Apply for Stall
 </Button>
 </div>
 </div>
 </header>

 <main>
 {/* Search Hero Section (Irembo-style) */}
 <section id="home" className="bg-white border-b border-slate-200 px-4 py-16 sm:px-6 lg:px-8">
 <div className="mx-auto max-w-4xl text-center">
 <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">
 Welcome to the Markets Portal
 </h1>
 <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
 Access civic services, apply for market space, pay dues, and manage your vendor profile online.
 </p>
 
 <div className="relative max-w-2xl mx-auto shadow-sm">
 <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
 <Search className="h-6 w-6 text-slate-400" />
 </div>
 <input 
 type="text" 
 className="block w-full rounded-sm border-2 border-slate-300 py-4 pl-12 pr-4 text-lg text-slate-900 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-0 transition-colors" 
 placeholder="What service are you looking for?" 
 />
 <div className="absolute inset-y-0 right-0 flex items-center pr-2">
 <Button className="bg-primary hover:bg-primary/90 text-white rounded-sm px-6 font-bold">
 Search
 </Button>
 </div>
 </div>
 
 <div className="mt-8 flex flex-wrap justify-center gap-2 text-sm text-slate-600">
 <span className="font-semibold text-slate-900">Popular:</span>
 <a href="#" className="hover:text-primary hover:underline">Pay Utilities</a>
 <span className="text-slate-300">•</span>
 <a href="#" className="hover:text-primary hover:underline">Renew License</a>
 <span className="text-slate-300">•</span>
 <a href="#" className="hover:text-primary hover:underline">Check Occupancy</a>
 </div>
 </div>
 </section>

 {/* Services Grid (eCitizen-style) */}
 <section id="services" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
 <div className="mb-8">
 <h2 className="text-2xl font-bold text-slate-900">Featured Services</h2>
 <div className="h-1 w-16 bg-warning mt-4"></div>
 </div>
 
 <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
 {topServices.map((service) => (
 <a 
 key={service.title} 
 href={service.link}
 className="group flex flex-col justify-between bg-white border border-slate-200 p-6 shadow-sm hover:shadow-sm transition-shadow hover:border-primary cursor-pointer"
 >
 <div>
 <div className="mb-4 inline-flex h-12 w-12 items-center justify-center bg-slate-100 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
 <service.icon className="h-6 w-6" />
 </div>
 <h3 className="mb-2 text-lg font-bold text-slate-900">{service.title}</h3>
 <p className="text-sm text-slate-600 leading-relaxed mb-6">{service.detail}</p>
 </div>
 <div className="flex items-center text-sm font-bold text-primary group-hover:underline">
 Access Service
 <ArrowRight className="ml-1 h-4 w-4" />
 </div>
 </a>
 ))}
 </div>
 </section>

 {/* Departments / Operations */}
 <section id="departments" className="bg-slate-900 text-white px-4 py-16 sm:px-6 lg:px-8">
 <div className="mx-auto max-w-7xl">
 <div className="grid gap-12 lg:grid-cols-2 items-center">
 <div>
 <h2 className="text-3xl font-bold mb-6">Centralized Operations</h2>
 <div className="h-1 w-16 bg-warning mb-8"></div>
 <p className="text-lg text-slate-300 mb-8">
 The Market Management System brings all regional workflows into a single, accountable digital environment. Designed for transparency and efficiency.
 </p>
 <div className="space-y-4">
 {["Real-time revenue tracking and receipt generation", "Automated vendor approval workflows", "Direct complaint lodging and SLA monitoring"].map((item, idx) => (
 <div key={idx} className="flex items-start gap-3">
 <CheckCircle2 className="mt-1 h-5 w-5 text-warning shrink-0" />
 <p className="font-medium text-slate-200">{item}</p>
 </div>
 ))}
 </div>
 </div>
 
 <div className="grid gap-4 sm:grid-cols-2">
 {departments.map((dept) => (
 <article key={dept.title} className="bg-slate-800 border border-slate-700 p-6 hover:border-slate-500 transition-colors">
 <dept.icon className="h-6 w-6 text-warning mb-4" />
 <h3 className="mb-2 text-base font-bold text-white">{dept.title}</h3>
 <p className="text-sm text-slate-400 leading-relaxed">{dept.detail}</p>
 </article>
 ))}
 </div>
 </div>
 </div>
 </section>
 </main>

 <footer id="support" className="bg-white border-t border-slate-200 px-4 py-12 sm:px-6 lg:px-8">
 <div className="mx-auto max-w-7xl grid gap-8 md:grid-cols-3 text-sm text-slate-600">
 <div>
 <div className="flex items-center gap-2 mb-4">
 <div className="flex h-8 w-8 items-center justify-center bg-primary text-white">
 <Landmark className="h-4 w-4" />
 </div>
 <p className="font-bold text-slate-900 text-lg">MMS</p>
 </div>
 <p>Official Market Management System for Kampala Civic Operations. Ensuring transparency and efficiency.</p>
 </div>
 <div>
 <p className="font-bold text-slate-900 mb-4 uppercase tracking-wider text-xs">Help & Support</p>
 <ul className="space-y-2">
 <li><a href="#" className="hover:text-primary hover:underline">FAQ</a></li>
 <li><a href="#" className="hover:text-primary hover:underline">User Guides</a></li>
 <li><a href="#" className="hover:text-primary hover:underline">Contact Support</a></li>
 </ul>
 </div>
 <div>
 <p className="font-bold text-slate-900 mb-4 uppercase tracking-wider text-xs">Legal</p>
 <ul className="space-y-2">
 <li><a href="#" className="hover:text-primary hover:underline">Terms of Service</a></li>
 <li><a href="#" className="hover:text-primary hover:underline">Privacy Policy</a></li>
 <li><a href="#" className="hover:text-primary hover:underline">Accessibility Statement</a></li>
 </ul>
 </div>
 </div>
 <div className="mx-auto max-w-7xl mt-12 pt-8 border-t border-slate-200 text-center text-xs text-slate-500">
 <p>© {new Date().getFullYear()} Kampala Capital City Authority. All rights reserved.</p>
 </div>
 </footer>
 </div>
 );
};

export default Index;
