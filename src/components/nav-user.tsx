import {
  ChevronUp,
  ChevronsUpDown,
  ScrollText,
  Settings,
  SunMoon,
} from "lucide-react"
import { useState, type MouseEvent } from "react"
import { useI18n } from "../i18n"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { ThemeColor, ThemePreference } from "@/types"

export function NavUser({
  user,
  onOpenSettings,
  onOpenDebug,
  showDebugButton = true,
  themePreference = "system",
  themeColor = "blue",
  onToggleTheme,
  onSelectThemeColor,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
  onOpenSettings?: () => void
  onOpenDebug?: () => void
  showDebugButton?: boolean
  themePreference?: ThemePreference
  themeColor?: ThemeColor
  onToggleTheme?: () => void
  onSelectThemeColor?: (color: ThemeColor) => void
}) {
  const { t } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showThemeColors, setShowThemeColors] = useState(false)
  const themeLabel =
    themePreference === "dark"
      ? t("settings.display.theme.dark")
      : themePreference === "light"
        ? t("settings.display.theme.light")
        : t("settings.display.theme.system")
  const themeColorOptions: Array<{
    id: ThemeColor
    label: string
    swatch: string
  }> = [
    { id: "default", label: "Default", swatch: "var(--color-slate-900)" },
    { id: "blue", label: "Blue", swatch: "var(--color-blue-500)" },
    { id: "green", label: "Green", swatch: "var(--color-green-500)" },
    { id: "orange", label: "Orange", swatch: "var(--color-orange-500)" },
    { id: "red", label: "Red", swatch: "var(--color-red-500)" },
    { id: "rose", label: "Rose", swatch: "var(--color-rose-500)" },
    { id: "violet", label: "Violet", swatch: "var(--color-violet-500)" },
    { id: "yellow", label: "Yellow", swatch: "var(--color-yellow-500)" },
  ]

  const handleToggleTheme = () => {
    onToggleTheme?.()
  }

  const handleToggleThemeColors = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setShowThemeColors((current) => !current)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu
          open={menuOpen}
          onOpenChange={(open) => {
            setMenuOpen(open)
            if (!open) {
              setShowThemeColors(false)
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="rounded-lg"
            style={{
              width: "calc(var(--radix-dropdown-menu-trigger-width) - 8px)",
              maxWidth: "calc(var(--radix-dropdown-menu-trigger-width) - 8px)",
            }}
            side="top"
            align="center"
            sideOffset={8}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => {
                  handleToggleTheme()
                }}
                className="justify-between gap-3"
              >
                <span className="flex items-center gap-2">
                  <SunMoon />
                  {t("settings.display.theme.label")}
                </span>
                <span
                  className="flex items-center gap-2 text-xs"
                  style={{ color: "var(--primary)" }}
                >
                  {themeLabel}
                  <button
                    type="button"
                    aria-label="Toggle theme colors"
                    onClick={handleToggleThemeColors}
                    className="hover:bg-accent focus-visible:ring-ring inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-offset-2"
                  >
                    <ChevronUp
                      className={
                        showThemeColors
                          ? "size-4 rotate-180 transition-transform"
                          : "size-4 transition-transform"
                      }
                    />
                  </button>
                </span>
              </DropdownMenuItem>
              {showThemeColors && (
                <div className="px-2 pb-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {themeColorOptions.map((option) => {
                      const isActive = option.id === themeColor
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-label={option.label}
                          title={option.label}
                          onClick={() => {
                            onSelectThemeColor?.(option.id)
                          }}
                          className={
                            isActive
                              ? "ring-ring ring-offset-background inline-flex size-5 cursor-pointer items-center justify-center rounded-full border border-transparent ring-2 ring-offset-2"
                              : "hover:border-ring/60 inline-flex size-5 cursor-pointer items-center justify-center rounded-full border border-border"
                          }
                          style={{ backgroundColor: option.swatch }}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  onOpenSettings?.()
                }}
              >
                <Settings />
                {t("sidebar.user.settings")}
              </DropdownMenuItem>
              {showDebugButton && (
                <DropdownMenuItem
                  onSelect={() => {
                    onOpenDebug?.()
                  }}
                >
                  <ScrollText />
                  {t("sidebar.user.debugLog")}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
