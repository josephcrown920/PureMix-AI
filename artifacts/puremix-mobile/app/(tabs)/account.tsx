import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";

const CREDITS = 8;
const TOTAL_MASTERS = 23;
const AVG_LUFS_IMPROVEMENT = "+9.4";

const MENU_ITEMS = [
  { icon: "bell" as const, label: "Notifications", desc: "Email alerts for completed masters" },
  { icon: "download" as const, label: "Download Quality", desc: "WAV 24-bit (recommended)" },
  { icon: "shield" as const, label: "Privacy", desc: "Data retention & storage" },
  { icon: "help-circle" as const, label: "Help & Support", desc: "Docs, tutorials, contact" },
  { icon: "star" as const, label: "Rate the App", desc: "Share your feedback" },
];

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 20, paddingBottom: bottomPad + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Name */}
        <View style={styles.profileHeader}>
          <LinearGradient
            colors={["#7B2FF7", "#d94ed4"]}
            style={styles.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarInitial}>A</Text>
          </LinearGradient>
          <View>
            <Text style={[styles.username, { color: colors.foreground }]}>Artist Studio</Text>
            <Text style={[styles.email, { color: colors.mutedForeground }]}>
              artist@puremix.ai
            </Text>
          </View>
          <View style={[styles.planBadge, { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }]}>
            <Feather name="zap" size={11} color={colors.primary} />
            <Text style={[styles.planBadgeText, { color: colors.primary }]}>{CREDITS} credits</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            colors={colors}
            icon="activity"
            value={String(TOTAL_MASTERS)}
            label="Total Masters"
          />
          <StatCard
            colors={colors}
            icon="trending-up"
            value={AVG_LUFS_IMPROVEMENT}
            label="Avg LUFS Gain"
          />
          <StatCard
            colors={colors}
            icon="credit-card"
            value={String(CREDITS)}
            label="Credits Left"
          />
        </View>

        {/* Credits Card */}
        <View style={styles.sectionTitle}>
          <Text style={[styles.sectionTitleText, { color: colors.mutedForeground }]}>CREDITS</Text>
        </View>
        <LinearGradient
          colors={["#1a0f35", "#0f0b1a"]}
          style={[styles.planCard, { borderColor: colors.primary }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.planCardTop}>
            <View>
              <Text style={[styles.planName, { color: colors.foreground }]}>Master Credits</Text>
              <Text style={[styles.planDesc, { color: colors.mutedForeground }]}>
                1 credit = 1 fully mastered track
              </Text>
            </View>
            <View style={[styles.creditsBadge, { backgroundColor: `${colors.primary}25` }]}>
              <Text style={[styles.creditsBadgeNum, { color: colors.primary }]}>{CREDITS}</Text>
              <Text style={[styles.creditsBadgeLabel, { color: colors.mutedForeground }]}>left</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={async () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            activeOpacity={0.85}
            style={[styles.upgradeBtn, { borderColor: colors.primary }]}
          >
            <Feather name="plus" size={13} color={colors.primary} />
            <Text style={[styles.upgradeBtnText, { color: colors.primary }]}>
              Add Credits
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Settings Menu */}
        <View style={styles.sectionTitle}>
          <Text style={[styles.sectionTitleText, { color: colors.mutedForeground }]}>SETTINGS</Text>
        </View>
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              onPress={async () => Haptics.selectionAsync()}
              activeOpacity={0.75}
              style={[
                styles.menuItem,
                i < MENU_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: `${colors.primary}12` }]}>
                <Feather name={item.icon} size={16} color={colors.primary} />
              </View>
              <View style={styles.menuText}>
                <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
                <Text style={[styles.menuDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.border} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          onPress={async () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
          activeOpacity={0.8}
          style={[styles.signOutBtn, { borderColor: "#ef444430", backgroundColor: "#ef444408" }]}
        >
          <Feather name="log-out" size={15} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          Puremix.ai v1.0.0 · AI Music Mastering
        </Text>
      </ScrollView>
    </View>
  );
}

function StatCard({
  colors,
  icon,
  value,
  label,
}: {
  colors: ReturnType<typeof useColors>;
  icon: React.ComponentProps<typeof Feather>["name"];
  value: string;
  label: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: `${colors.primary}15` }]}>
        <Feather name={icon} size={14} color={colors.primary} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  username: { fontSize: 17, fontFamily: "Inter_700Bold" },
  email: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: "auto",
  },
  planBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center", letterSpacing: 0.2 },
  sectionTitle: { marginBottom: 10 },
  sectionTitleText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  planCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    marginBottom: 24,
  },
  planCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  planDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  creditsBadge: { alignItems: "center", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  creditsBadgeNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  creditsBadgeLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
  },
  upgradeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  menuCard: { borderWidth: 1, borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  menuIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  menuDesc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 20,
  },
  signOutText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#ef4444" },
  version: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
});
