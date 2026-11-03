import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { language, useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { buy, loadOffering, restore, trialEligible } from '@/lib/purchases';
import { colors, radius, space } from '@/theme/tokens';

const SITE = 'https://gwin14.github.io/Sun-seeker';
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const privacyUrl = () => `${SITE}/${language()}/privacy.html`;

type Plan = 'annual' | 'monthly' | 'lifetime';

function plans(offering: PurchasesOffering | null) {
  return { annual: offering?.annual ?? null, monthly: offering?.monthly ?? null, lifetime: offering?.lifetime ?? null };
}

/** Days of a free trial, when the intro offer is one. */
function trialDays(pkg: PurchasesPackage | null): number | null {
  const intro = pkg?.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const unit = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }[intro.periodUnit] ?? 0;
  return intro.periodNumberOfUnits * unit * Math.max(1, intro.cycles) || null;
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const tx = useT();
  const t = tx.pro;
  const [offering, setOffering] = useState<PurchasesOffering | null | undefined>(undefined);
  const [plan, setPlan] = useState<Plan>('annual');
  const [eligible, setEligible] = useState(true);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(() => {
    loadOffering().then(setOffering);
  }, []);
  const retry = () => {
    setOffering(undefined);
    loadOffering().then(setOffering);
  };

  const { annual, monthly, lifetime } = plans(offering ?? null);
  useEffect(() => {
    if (annual) trialEligible(annual.product.identifier).then(setEligible);
  }, [annual]);

  const trial = eligible ? trialDays(annual) : null;
  const savePct = annual && monthly && monthly.product.price > 0 ? Math.round((1 - annual.product.price / (monthly.product.price * 12)) * 100) : 0;
  const selected = plans(offering ?? null)[plan];

  const finish = () => {
    haptic.success();
    Alert.alert(t.thanksTitle, t.thanksBody, [{ text: tx.common.ok, onPress: () => router.back() }]);
  };

  const purchase = async () => {
    if (!selected) return;
    setBusy('buy');
    const outcome = await buy(selected);
    setBusy(null);
    if (outcome === 'purchased') finish();
    else if (outcome === 'failed') {
      haptic.warning();
      Alert.alert(t.title, t.failed);
    }
  };

  const restorePurchases = async () => {
    setBusy('restore');
    const ok = await restore();
    setBusy(null);
    if (ok) finish();
    else Alert.alert(t.restore, t.nothingToRestore);
  };

  const cta = plan === 'lifetime' ? t.buy : plan === 'annual' && trial ? t.startTrial : t.subscribe;

  return (
    <View style={{ flex: 1, backgroundColor: colors.inkSheet }}>
      <PressableScale
        onPress={() => router.back()}
        hapticOnPress="soft"
        style={[styles.close, { top: space.md }]}
        accessibilityRole="button"
        accessibilityLabel={tx.common.close}>
        <Icon name="close" size={15} color={colors.textSecondary} />
      </PressableScale>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.xxxl, paddingBottom: space.lg, gap: space.xl }}>
        <View style={{ gap: space.xs, alignItems: 'center' }}>
          <View style={styles.mark}>
            <Icon name="sun" size={30} color={colors.accent} />
          </View>
          <Text variant="largeTitle" align="center">
            {t.title}
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center">
            {t.subtitle}
          </Text>
        </View>

        <View style={{ gap: space.md }}>
          {t.features.map((f) => (
            <View key={f.title} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Icon name={f.icon} size={17} color={colors.text} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="headline">{f.title}</Text>
                <Text variant="subhead" color={colors.textSecondary}>
                  {f.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {offering === undefined ? (
          <ActivityIndicator color={colors.textSecondary} style={{ paddingVertical: space.xxl }} />
        ) : !annual && !monthly && !lifetime ? (
          <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
            <Text variant="callout" color={colors.textSecondary} align="center">
              {t.unavailable}
            </Text>
            <Button label={t.retry} variant="secondary" size="medium" onPress={retry} />
          </View>
        ) : (
          <View style={{ gap: space.xs }} accessibilityRole="radiogroup">
            {annual ? (
              <PlanRow
                selected={plan === 'annual'}
                onPress={() => setPlan('annual')}
                title={t.annual}
                detail={trial ? t.trialThen(trial, t.perYear(annual.product.priceString)) : t.perYear(annual.product.priceString)}
                trailing={annual.product.pricePerMonthString ? t.perMonth(annual.product.pricePerMonthString) : undefined}
                badge={savePct > 0 ? t.save(savePct) : undefined}
              />
            ) : null}
            {monthly ? (
              <PlanRow selected={plan === 'monthly'} onPress={() => setPlan('monthly')} title={t.monthly} detail={t.perMonth(monthly.product.priceString)} />
            ) : null}
            {lifetime ? (
              <PlanRow selected={plan === 'lifetime'} onPress={() => setPlan('lifetime')} title={t.lifetime} detail={`${lifetime.product.priceString} · ${t.once}`} />
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}>
        <Button label={cta} onPress={purchase} disabled={!selected || busy === 'restore'} loading={busy === 'buy'} />
        <Text variant="caption" color={colors.textTertiary} align="center">
          {plan === 'lifetime' ? t.legalLifetime : t.legal}
        </Text>
        <View style={styles.links}>
          <Link label={t.restore} onPress={restorePurchases} disabled={busy != null} />
          <Text variant="caption" color={colors.textTertiary}>
            ·
          </Text>
          <Link label={t.terms} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} />
          <Text variant="caption" color={colors.textTertiary}>
            ·
          </Text>
          <Link label={t.privacy} onPress={() => WebBrowser.openBrowserAsync(privacyUrl())} />
        </View>
      </View>
    </View>
  );
}

function PlanRow({ selected, onPress, title, detail, trailing, badge }: { selected: boolean; onPress: () => void; title: string; detail: string; trailing?: string; badge?: string }) {
  return (
    <PressableScale
      onPress={onPress}
      hapticOnPress="tick"
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.plan, selected && styles.planOn]}>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <Icon name="check" size={11} color={colors.onPrimary} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Text variant="headline">{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text variant="caption" color={colors.accent} style={{ fontWeight: '600' }}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="subhead" color={colors.textSecondary}>
          {detail}
        </Text>
      </View>
      {trailing ? (
        <Text variant="subhead" color={colors.textSecondary} style={{ fontVariant: ['tabular-nums'] }}>
          {trailing}
        </Text>
      ) : null}
    </PressableScale>
  );
}

function Link({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} hapticOnPress="soft" accessibilityRole="link" style={{ paddingVertical: space.xxs }}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  close: {
    position: 'absolute',
    right: space.md,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  feature: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  featureIcon: { width: 34, height: 34, borderRadius: radius.tile, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.fill,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  planOn: { borderColor: colors.primary, backgroundColor: colors.fillStrong },
  radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.textTertiary, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  badge: { paddingHorizontal: space.xs, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs },
});
