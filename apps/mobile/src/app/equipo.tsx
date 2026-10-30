import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { canManageTeam, colors, normalizePhone, radius, ROLE_DETAIL, ROLE_LABEL, ROLES, shadow, type Member, type Role } from "@trazagro/shared";
import { api, ApiError } from "../lib/api";
import { useFarm } from "../lib/farm";
import { loadSession, type Session } from "../lib/session";
import { Icon } from "../ui/Icon";
import { Banner, Button, Chip, Empty, Field, GreenHeader, Sheet, Txt } from "../ui/kit";

/** Who works on the farm. Invites go by phone: the person enters with that number and sees the farm. */
export default function EquipoScreen() {
  const router = useRouter();
  const { farm, role } = useFarm();
  const [session, setSession] = useState<Session | null>();
  const [members, setMembers] = useState<Member[]>();
  const [error, setError] = useState<string>();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Member>();
  const [msg, setMsg] = useState<string>();
  const manage = canManageTeam(role);

  const load = useCallback(async () => {
    const s = await loadSession();
    setSession(s);
    if (!s || !farm || farm.isDemo) return;
    try {
      setMembers(await api.members(s.token, farm.id));
      setError(undefined);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 403 ? "Esta finca todavía no está en la nube. Sincroniza primero desde Cuenta." : e instanceof ApiError ? e.message : "Sin conexión");
    }
  }, [farm]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      setMsg(ok);
      setInviting(false);
      setEditing(undefined);
      await load();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "No se pudo. Revisa tu conexión.");
    }
  }

  const blocked = !farm ? "Primero registra una finca." : farm.isDemo ? "La finca de prueba no se comparte. Registra tu finca para invitar a tu equipo." : session === null ? "Inicia sesión para invitar a tu equipo." : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <GreenHeader back kicker={farm?.name.toUpperCase() ?? ""} title="Equipo">
          <Txt w="medium" size={15} color={colors.onDarkMuted}>{`Tu rol: ${ROLE_LABEL[role]}`}</Txt>
        </GreenHeader>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {blocked ? (
            <>
              <Banner icon="users" tone="warn" title={blocked} />
              {session === null && !farm?.isDemo ? <Button label="Iniciar sesión" onPress={() => router.push("/cuenta")} /> : null}
            </>
          ) : null}
          {error ? <Banner icon="wifiOff" tone="danger" title={error} /> : null}
          {msg ? <Banner icon="check" tone="ok" title={msg} /> : null}
          {members?.map((m) => (
            <Pressable key={m.userId} disabled={!manage || m.role === "dueno" || m.userId === session?.user.id} onPress={() => { setMsg(undefined); setEditing(m); }}
              accessibilityRole="button" accessibilityLabel={`${m.fullName ?? m.phone}, ${ROLE_LABEL[m.role]}`} style={s.row}>
              <View style={s.avatar}><Txt w="extrabold" size={16} color={colors.selva}>{(m.fullName ?? m.phone.slice(-2)).slice(0, 2).toUpperCase()}</Txt></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt w="bold" size={16}>{m.fullName ?? m.phone.replace("+57", "")}{m.userId === session?.user.id ? " (tú)" : ""}</Txt>
                <Txt size={13} color={colors.textMuted}>{ROLE_LABEL[m.role]}</Txt>
              </View>
              {manage && m.role !== "dueno" && m.userId !== session?.user.id ? <Icon name="edit" color={colors.textMuted} size={18} /> : null}
            </Pressable>
          ))}
          {members && members.length === 1 ? <Empty title="Solo tú por ahora" text="Invita al vaquero, al administrador o al veterinario." /> : null}
          {!blocked && manage ? <Button icon="plus" label="Invitar por celular" onPress={() => { setMsg(undefined); setInviting(true); }} /> : null}

          <Txt w="extrabold" size={19} style={{ marginTop: 8 }}>Qué puede hacer cada rol</Txt>
          {ROLES.map((r) => (
            <View key={r} style={s.roleRow}>
              <Txt w="bold" size={15}>{ROLE_LABEL[r]}</Txt>
              <Txt size={13} color={colors.textMuted}>{ROLE_DETAIL[r]}</Txt>
            </View>
          ))}
        </View>
      </ScrollView>

      <Sheet open={inviting} onClose={() => setInviting(false)} title="Invitar a la finca">
        <InviteForm canAdmin={role === "dueno"} onSave={(phone, r, name) => run(() => api.invite(session!.token, farm!.id, phone, r, name),
          "Listo. Cuando entre a TrazAgro con ese celular verá la finca.")} />
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(undefined)} title={editing?.fullName ?? editing?.phone ?? ""}>
        {editing ? (
          <View style={{ gap: 10 }}>
            <RolePicker value={editing.role} canAdmin={role === "dueno"} onChange={(r) => run(() => api.changeRole(session!.token, farm!.id, editing.userId, r), `Ahora es ${ROLE_LABEL[r]}`)} />
            <Button kind="danger" label="Quitar de la finca" onPress={() => run(() => api.removeMember(session!.token, farm!.id, editing.userId), "Ya no tiene acceso a la finca")} />
          </View>
        ) : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function RolePicker({ value, canAdmin, onChange }: { value: Role; canAdmin: boolean; onChange: (r: Role) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {ROLES.filter((r) => r !== "dueno" && (canAdmin || r !== "administrador")).map((r) => (
        <Chip key={r} label={ROLE_LABEL[r]} active={value === r} onPress={() => onChange(r)} />
      ))}
    </View>
  );
}

function InviteForm({ canAdmin, onSave }: { canAdmin: boolean; onSave: (phone: string, role: Role, name?: string) => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("vaquero");
  return (
    <View style={{ gap: 12 }}>
      <Field label="Celular" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Ej: 310 555 0000" />
      <Field label="Nombre (opcional)" value={name} onChangeText={setName} placeholder="Ej: Don Jairo" autoCapitalize="words" />
      <RolePicker value={role} canAdmin={canAdmin} onChange={setRole} />
      <Txt size={13} color={colors.textMuted}>{ROLE_DETAIL[role]}</Txt>
      <Button label="Invitar" disabled={!normalizePhone(phone)} onPress={() => onSave(phone, role, name.trim() || undefined)} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, ...shadow },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.limaSoft, alignItems: "center", justifyContent: "center" },
  roleRow: { backgroundColor: colors.card, borderRadius: radius.md, padding: 12, gap: 2 },
});
