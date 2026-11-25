/**
 * Codes d'invitation (docs/SPEC.md, « Lot 4 », « Étape 6 »).
 * Un code (`CLST-7K4Q-9M2P`) permet à une personne de configurer son téléphone sans recevoir de jeton :
 * le lien d'invitation peut donc passer par une messagerie. Le code sert une seule fois, 7 jours au plus.
 *
 * Rangées dans la base SQLite du Durable Object `Quota` (et non dans KV, qui met jusqu'à une minute à
 * diffuser un changement) : la vérification et l'effacement du code se font en une seule opération,
 * donc un même code ne peut pas servir deux fois, même essayé au même instant depuis deux téléphones.
 * Le relais ne garde que l'empreinte SHA-256 du code, jamais le code lui-même.
 */
import type { BaseSql } from './quota';
import { settings } from './settings';

/** Caractères des codes : lettres et chiffres sans 0/O ni 1/I (32 caractères, faciles à recopier). */
export const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Invitation en attente, telle que la voit l'administrateur (jamais le code ni son empreinte). */
export type Invitation = { id: string; nom: string; cree_le: string; expire_le: string };

/** Ce que le Worker demande au Durable Object pour les invitations (appels à distance). */
export interface ObjetInvitations {
  creerInvitation(empreinte: string, nom: string): Promise<Invitation>;
  listerInvitations(): Promise<Invitation[]>;
  annulerInvitation(id: string): Promise<boolean>;
  /** Vérifie et efface le code en une seule opération ; renvoie le nom prévu, ou null. */
  utiliserInvitation(empreinte: string): Promise<{ nom: string } | null>;
}

/** Nouveau code au format `CLST-XXXX-XXXX` (8 caractères tirés au hasard, 40 bits). */
export function nouveauCode(): string {
  const octets = crypto.getRandomValues(new Uint8Array(settings.longueurCodeInvitation));
  // 256 est un multiple de 32 : chaque caractère a exactement la même chance d'être tiré.
  const tires = [...octets].map((o) => ALPHABET_CODE[o % ALPHABET_CODE.length]).join('');
  return [settings.prefixeCodeInvitation, tires.slice(0, 4), tires.slice(4)].join('-');
}

/**
 * Code saisi ou reçu, ramené à sa forme unique (`CLST7K4Q9M2P`, sans tirets) ; null s'il est mal formé.
 * Accepte minuscules, espaces et tirets, avec ou sans le préfixe `CLST`.
 */
export function normaliserCode(saisie: unknown): string | null {
  if (typeof saisie !== 'string' || saisie.length > 40) return null;
  let propre = saisie.toUpperCase().replace(/[\s-]/g, '');
  const prefixe = settings.prefixeCodeInvitation;
  if (propre.length === settings.longueurCodeInvitation) propre = prefixe + propre;
  if (propre.length !== prefixe.length + settings.longueurCodeInvitation || !propre.startsWith(prefixe)) return null;
  const tires = propre.slice(prefixe.length);
  return [...tires].every((c) => ALPHABET_CODE.includes(c)) ? propre : null;
}

/**
 * Logique des invitations, sur la base SQLite du Durable Object. Opérations synchrones : rien ne peut
 * s'intercaler entre la vérification d'un code et son effacement.
 */
export class RegistreInvitations {
  constructor(private readonly sql: BaseSql) {
    sql.exec(`CREATE TABLE IF NOT EXISTS invitation (
      id TEXT PRIMARY KEY, empreinte TEXT NOT NULL UNIQUE, nom TEXT NOT NULL,
      cree_le TEXT NOT NULL, expire_le TEXT NOT NULL)`);
  }

  /** Efface les invitations expirées (aucune n'est gardée au-delà de 7 jours). */
  private purger(maintenant: Date) {
    this.sql.exec('DELETE FROM invitation WHERE expire_le <= ?', maintenant.toISOString());
  }

  creer(empreinte: string, nom: string, maintenant: Date): Invitation {
    this.purger(maintenant);
    const invitation: Invitation = {
      id: crypto.randomUUID(),
      nom,
      cree_le: maintenant.toISOString(),
      expire_le: new Date(maintenant.getTime() + settings.dureeInvitationMs).toISOString(),
    };
    this.sql.exec(
      'INSERT INTO invitation (id, empreinte, nom, cree_le, expire_le) VALUES (?, ?, ?, ?, ?)',
      invitation.id, empreinte, nom, invitation.cree_le, invitation.expire_le,
    );
    return invitation;
  }

  lister(maintenant: Date): Invitation[] {
    this.purger(maintenant);
    return this.sql
      .exec('SELECT id, nom, cree_le, expire_le FROM invitation ORDER BY cree_le')
      .toArray()
      .map((l) => ({ id: String(l.id), nom: String(l.nom), cree_le: String(l.cree_le), expire_le: String(l.expire_le) }));
  }

  annuler(id: string): boolean {
    const trouvee = this.sql.exec('SELECT id FROM invitation WHERE id = ?', id).toArray().length > 0;
    if (trouvee) this.sql.exec('DELETE FROM invitation WHERE id = ?', id);
    return trouvee;
  }

  utiliser(empreinte: string, maintenant: Date): { nom: string } | null {
    this.purger(maintenant);
    const ligne = this.sql.exec('SELECT nom FROM invitation WHERE empreinte = ?', empreinte).toArray()[0];
    if (!ligne) return null;
    this.sql.exec('DELETE FROM invitation WHERE empreinte = ?', empreinte);
    return { nom: String(ligne.nom) };
  }
}
