import { useCallback, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { canManageTeam, colors, normalizePhone, plural, ROLE_DETAIL, ROLE_LABEL, ROLES, type Member, type Role } from "@trazagro/shared";
import { api, ApiError } from "../lib/api";
import { useFarm } from "../lib/farm";
import { loadSession, type Session } from "../lib/session";
import { Icon } from "../ui/Icon";
import { Button, Sheet, Txt } from "../ui/kit";
import { Rise, Tap } from "../ui/motion";
import { Avatar, CuentaHeader, DoneMark, GlassTag, HeaderPill, ListRow, PillInput, RadioPill, ROLE_SHORT, RoleChip, SectionKicker, SoftCard, StatusCard } from "../ui/cuenta/parts";

const fmt = (p: string) => { const d = p.replace(/^\+57/, ""); return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : p; };

/** Usuarios y permisos (Usuarios.dc + SheetInvitar.dc). Invites go by phone: the person enters with that number and sees the farm. */
export default function EquipoScreen() {
  const router = useRouter();
  const { farm, role } = useFarm();
  const [session, setSession] = useState<Session | null>();
  const [members, setMembers] = useState<Member[]>();
  const [error, setError] = useState<string>();
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState<{ phone: string; role: Role }>();
  const [editing, setEditing] = useState<Member>();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [sheetErr, setSheetErr] = useState<string>();
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

  /** Runs a team change; errors stay inside the open sheet, success shows on the page. */
  async function run(fn: () => Promise<unknown>, ok: string, after?: () => void) {
    setSheetErr(undefined);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      if (after) after(); else { setInviting(false); setEditing(undefined); }
      await load();
    } catch (e) {
      setSheetErr(e instanceof ApiError ? e.message : "No se pudo. Revisa tu conexión.");
    }
  }

  const blocked = !farm ? "Primero registra una finca." : farm.isDemo ? "La finca de prueba no se comparte. Registra tu finca para invitar a tu equipo." : session === null ? "Inicia sesión para invitar a tu equipo." : undefined;
  const canInvite = !blocked && manage;
  const openInvite = () => { setMsg(undefined); setSheetErr(undefined); setInvited(undefined); setInviting(true); };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.crema }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <CuentaHeader kicker={`${members ? `${plural(members.length, "PERSONA", "PERSONAS")} · ` : ""}${farm?.name.toUpperCase() ?? ""}`} title="Usuarios y permisos"
          right={canInvite ? <HeaderPill label="Agregar persona" onPress={openInvite} /> : undefined}>
          <View style={{ flexDirection: "row" }}><GlassTag>{`Tu rol: ${ROLE_LABEL[role]}`}</GlassTag></View>
        </CuentaHeader>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {blocked ? (
            <Rise index={0} style={{ gap: 10 }}>
              <StatusCard icon="users" tone="warn" title={blocked} />
              {session === null && !farm?.isDemo ? <Button label="Iniciar sesión" onPress={() => router.push("/cuenta")} /> : null}
            </Rise>
          ) : null}
          {error ? <StatusCard icon="cloudOff" tone="danger" title={error} /> : null}
          {msg ? <StatusCard icon={msg.ok ? "check" : "alert"} tone={msg.ok ? "dark" : "danger"} dark={msg.ok} title={msg.text} action="Cerrar" actionLabel="Cerrar aviso" onAction={() => setMsg(undefined)} /> : null}

          {members?.length ? (
            <View style={{ gap: 8 }} accessibilityLabel="Personas con acceso">
              {members.map((m, i) => {
                const me = m.userId === session?.user.id;
                const editable = manage && m.role !== "dueno" && !me;
                const name = m.fullName ?? fmt(m.phone);
                return (
                  <Rise key={m.userId} index={i + 1}>
                    <Row editable={editable} onPress={() => { setMsg(undefined); setSheetErr(undefined); setEditing(m); }}
                      label={`${m.fullName ?? m.phone}, ${ROLE_LABEL[m.role]}`}>
                      <Avatar name={m.fullName ?? m.phone.slice(-2)} />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Txt w="bold" size={15} numberOfLines={1}>{`${name}${me ? " · tú" : ""}`}</Txt>
                        <Txt size={12} color={colors.textMuted}>{m.fullName ? `+57 ${fmt(m.phone)}` : m.role === "dueno" ? "Dueño de la finca" : "Entra con este celular"}</Txt>
                      </View>
                      <RoleChip role={m.role} />
                      {editable ? <Icon name="chevron" color={colors.textMuted} size={18} /> : null}
                    </Row>
                  </Rise>
                );
              })}
            </View>
          ) : null}
          {members && members.length === 1 ? (
            <Rise index={2}>
              <SoftCard style={{ alignItems: "center", gap: 6 }}>
                <Txt w="bold" size={17}>Solo tú por ahora</Txt>
                <Txt size={14} color={colors.textMuted} style={{ textAlign: "center" }}>Invita al vaquero, al administrador o al veterinario.</Txt>
              </SoftCard>
            </Rise>
          ) : null}

          <Rise index={(members?.length ?? 0) + 2}>
            <SoftCard list style={{ paddingVertical: 6 }}>
              <SectionKicker style={{ marginTop: 10, marginBottom: 4 }}>QUÉ PUEDE HACER CADA ROL</SectionKicker>
              {ROLES.map((r, i) => (
                <ListRow key={r} last={i === ROLES.length - 1} style={{ minHeight: 0, paddingVertical: 9, gap: 10 }}>
                  <RoleChip role={r} width={104} />
                  <Txt size={13} color="#3E4640" style={{ flex: 1, lineHeight: 18 }}>{ROLE_DETAIL[r]}</Txt>
                </ListRow>
              ))}
            </SoftCard>
          </Rise>
        </View>
      </ScrollView>

      <Sheet open={inviting} onClose={() => setInviting(false)} title={invited ? "" : "Agregar persona"}>
        {invited ? (
          <View accessibilityRole="alert" style={{ alignItems: "center", gap: 10 }}>
            <DoneMark />
            <Txt w="extrabold" size={24}>Invitación lista</Txt>
            <Txt size={14} color={colors.textMuted} style={{ textAlign: "center", lineHeight: 21 }}>
              {`Cuando entre a TrazAgro con el celular +57 ${fmt(normalizePhone(invited.phone) ?? invited.phone)} verá ${farm?.name ?? "la finca"} como ${ROLE_SHORT[invited.role]}. Avísale para que entre.`}
            </Txt>
            <Button label="Listo" style={{ alignSelf: "stretch", marginTop: 6 }} onPress={() => setInviting(false)} />
          </View>
        ) : (
          <InviteForm canAdmin={role === "dueno"} farmName={farm?.name ?? ""} error={sheetErr}
            onSave={(phone, r, name) => run(() => api.invite(session!.token, farm!.id, phone, r, name),
              "Listo. Cuando entre a TrazAgro con ese celular verá la finca.", () => setInvited({ phone, role: r }))} />
        )}
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(undefined)} title={editing?.fullName ?? (editing ? `+57 ${fmt(editing.phone)}` : "")}>
        {editing ? (
          <MemberForm member={editing} canAdmin={role === "dueno"} farmName={farm?.name ?? ""} error={sheetErr}
            onRole={(r) => run(() => api.changeRole(session!.token, farm!.id, editing.userId, r), `Ahora es ${ROLE_LABEL[r]}`)}
            onRemove={() => run(() => api.removeMember(session!.token, farm!.id, editing.userId), "Ya no tiene acceso a la finca")} />
        ) : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

/** A person row: tappable only when the current user may change that member. */
function Row({ editable, onPress, label, children }: { editable: boolean; onPress: () => void; label: string; children: ReactNode }) {
  if (!editable) return <View style={s.person} accessible accessibilityLabel={label}>{children}</View>;
  return <Tap onPress={onPress} style={s.person} accessibilityRole="button" accessibilityLabel={label}>{children}</Tap>;
}

function RolePicker({ value, canAdmin, onChange }: { value: Role; canAdmin: boolean; onChange: (r: Role) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Rol" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {ROLES.filter((r) => r !== "dueno" && (canAdmin || r !== "administrador")).map((r) => (
        <RadioPill key={r} label={ROLE_SHORT[r]} accessibilityLabel={ROLE_LABEL[r]} on={value === r} onPress={() => onChange(r)} />
      ))}
    </View>
  );
}

function SheetError({ text }: { text?: string }) {
  return text ? <StatusCard icon="alert" tone="danger" title={text} /> : null;
}

function InviteForm({ canAdmin, farmName, error, onSave }: { canAdmin: boolean; farmName: string; error?: string; onSave: (phone: string, role: Role, name?: string) => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("vaquero");
  return (
    <View style={{ gap: 12 }}>
      <PillInput prefix="+57" height={54} fill={colors.crema} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Número de celular" accessibilityLabel="Celular" />
      <PillInput height={54} fill={colors.crema} value={name} onChangeText={setName} placeholder="Nombre de la persona (opcional)" autoCapitalize="words" accessibilityLabel="Nombre" />
      <View style={{ gap: 6 }}>
        <Txt w="bold" size={13}>Rol</Txt>
        <RolePicker value={role} canAdmin={canAdmin} onChange={setRole} />
        <Txt size={12} color={colors.textMuted}>{ROLE_DETAIL[role]}</Txt>
      </View>
      <View style={{ gap: 4 }}>
        <Txt w="bold" size={13}>Finca</Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 }} accessibilityRole="checkbox" accessibilityState={{ checked: true, disabled: true }} aria-checked>
          <View style={s.check}><Icon name="check" color="#FFFFFF" size={14} width={3} /></View>
          <Txt size={15}>{farmName}</Txt>
        </View>
      </View>
      <SheetError text={error} />
      <Button label="Enviar invitación" disabled={!normalizePhone(phone)} onPress={() => onSave(phone, role, name.trim() || undefined)} />
    </View>
  );
}

/** Member detail in the look of PerfilUsuario.dc: role radios, then "Quitar acceso" with an inline confirmation. */
function MemberForm({ member, canAdmin, farmName, error, onRole, onRemove }: {
  member: Member; canAdmin: boolean; farmName: string; error?: string; onRole: (r: Role) => void; onRemove: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 8 }}>
        <SectionKicker>ROL</SectionKicker>
        <RolePicker value={member.role} canAdmin={canAdmin} onChange={onRole} />
        <Txt size={12} color={colors.textMuted}>{ROLE_DETAIL[member.role]}</Txt>
      </View>
      <SheetError text={error} />
      {!confirm ? (
        <Tap accessibilityRole="button" accessibilityLabel="Quitar de la finca" onPress={() => setConfirm(true)} style={s.remove}>
          <Txt w="bold" size={15} color={colors.danger}>Quitar acceso a esta persona</Txt>
        </Tap>
      ) : (
        <View accessibilityRole="alert" style={s.confirm}>
          <Txt size={14} color={colors.urgentText} style={{ lineHeight: 20 }}>{`Ya no podrá entrar a ${farmName}. Lo que registró se queda en la trazabilidad.`}</Txt>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Tap accessibilityRole="button" accessibilityLabel="Cancelar" onPress={() => setConfirm(false)} style={[s.confirmBtn, { backgroundColor: colors.card }]}>
              <Txt w="bold" size={14}>Cancelar</Txt>
            </Tap></View>
            <View style={{ flex: 1 }}><Tap accessibilityRole="button" accessibilityLabel="Sí, quitar" onPress={onRemove} style={[s.confirmBtn, { backgroundColor: colors.danger }]}>
              <Txt w="bold" size={14} color={colors.onDark}>Sí, quitar</Txt>
            </Tap></View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  person: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 12, paddingRight: 10, backgroundColor: colors.card, borderRadius: 22,
    shadowColor: colors.selva, shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  check: { width: 22, height: 22, borderRadius: 6, backgroundColor: colors.selva, alignItems: "center", justifyContent: "center" },
  remove: { height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: "#F5C2C2", backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  confirm: { gap: 10, padding: 14, borderRadius: 20, backgroundColor: colors.dangerSoft },
  confirmBtn: { height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
});
