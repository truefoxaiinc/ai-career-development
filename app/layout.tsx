import './globals.css'; import {Providers} from '@/components/providers';
export const metadata={title:'CareerPilot',description:'Career tools that cite the evidence behind every claim.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>}
