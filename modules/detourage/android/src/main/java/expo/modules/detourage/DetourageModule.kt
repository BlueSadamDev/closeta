package expo.modules.detourage

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.TimeUnit

class DetourageException(message: String) : CodedException(message)

class OptionsComposition : Record {
  @Field val decoupe: String = ""
  @Field val sourceX: Int = 0
  @Field val sourceY: Int = 0
  @Field val sourceLargeur: Int = 1
  @Field val sourceHauteur: Int = 1
  @Field val destX: Int = 0
  @Field val destY: Int = 0
  @Field val destLargeur: Int = 1
  @Field val destHauteur: Int = 1
  @Field val sortieLargeur: Int = 1200
  @Field val sortieHauteur: Int = 1600
  @Field val fond: String = "#E4DDD2"
  @Field val ombreDx: Int = 0
  @Field val ombreDy: Int = 0
  @Field val ombreOpacite: Double = 0.0
  @Field val ombreFlou: Int = 1
  @Field val qualite: Double = 0.9
}

/**
 * Détourage des photos du Vestiaire (ClosetA, docs/SPEC.md, « Étape 8 »).
 * Tout se fait sur le téléphone : aucune photo n'est envoyée.
 * 1. segmenterAsync : détoure la pièce (ML Kit Subject Segmentation), à la taille réelle de la photo.
 * 2. composerAsync : pose la pièce sur un fond uni, à la place calculée par l'app (src/domain/habillage.ts).
 */
class DetourageModule : Module() {
  private val cache: File
    get() = appContext.reactContext?.cacheDir ?: throw DetourageException("Stockage indisponible")

  private fun chemin(uri: String): String = Uri.parse(uri).path ?: uri

  private fun enregistrer(image: Bitmap, format: Bitmap.CompressFormat, qualite: Int, extension: String): String {
    val fichier = File(cache, "detourage-${UUID.randomUUID()}.$extension")
    FileOutputStream(fichier).use { image.compress(format, qualite, it) }
    return Uri.fromFile(fichier).toString()
  }

  override fun definition() = ModuleDefinition {
    Name("Detourage")

    AsyncFunction("segmenterAsync") { uri: String, confiance: Double ->
      val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
      val photo = BitmapFactory.decodeFile(chemin(uri), options) ?: throw DetourageException("Photo illisible")
      val segmenteur = SubjectSegmentation.getClient(
        SubjectSegmenterOptions.Builder().enableForegroundConfidenceMask().build()
      )
      try {
        val resultat = Tasks.await(segmenteur.process(InputImage.fromBitmap(photo, 0)), 30, TimeUnit.SECONDS)
        val masque = resultat.foregroundConfidenceMask ?: throw DetourageException("Aucune pièce détectée")
        val largeur = photo.width
        val hauteur = photo.height
        val pixels = IntArray(largeur * hauteur)
        photo.getPixels(pixels, 0, largeur, 0, 0, largeur, hauteur)
        val lignes = IntArray(hauteur)
        val colonnes = IntArray(largeur)
        masque.rewind()
        for (i in 0 until largeur * hauteur) {
          val c = masque.get().coerceIn(0f, 1f)
          pixels[i] = (pixels[i] and 0x00FFFFFF) or ((c * 255f).toInt() shl 24)
          if (c >= confiance) {
            lignes[i / largeur]++
            colonnes[i % largeur]++
          }
        }
        val decoupe = Bitmap.createBitmap(pixels, largeur, hauteur, Bitmap.Config.ARGB_8888)
        val fichier = enregistrer(decoupe, Bitmap.CompressFormat.PNG, 100, "png")
        decoupe.recycle()
        mapOf(
          "decoupe" to fichier,
          "largeur" to largeur,
          "hauteur" to hauteur,
          "lignes" to lignes.toList(),
          "colonnes" to colonnes.toList(),
        )
      } finally {
        segmenteur.close()
        photo.recycle()
      }
    }

    AsyncFunction("composerAsync") { o: OptionsComposition ->
      val decoupe = BitmapFactory.decodeFile(chemin(o.decoupe)) ?: throw DetourageException("Découpe illisible")
      try {
        val sortie = Bitmap.createBitmap(o.sortieLargeur, o.sortieHauteur, Bitmap.Config.ARGB_8888)
        val toile = Canvas(sortie)
        toile.drawColor(Color.parseColor(o.fond))
        val source = Rect(o.sourceX, o.sourceY, o.sourceX + o.sourceLargeur, o.sourceY + o.sourceHauteur)
        val destination = Rect(o.destX, o.destY, o.destX + o.destLargeur, o.destY + o.destHauteur)
        val lisse = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

        // Ombre douce : la silhouette réduite puis agrandie (ce qui la floute), teintée et décalée.
        if (o.ombreOpacite > 0) {
          val flou = o.ombreFlou.coerceAtLeast(1)
          val petite = Bitmap.createBitmap(
            (o.destLargeur / flou).coerceAtLeast(1), (o.destHauteur / flou).coerceAtLeast(1), Bitmap.Config.ARGB_8888
          )
          Canvas(petite).drawBitmap(decoupe, source, Rect(0, 0, petite.width, petite.height), lisse)
          val silhouette = petite.extractAlpha()
          petite.recycle()
          val teinte = Paint(lisse).apply { color = Color.rgb(60, 48, 35); alpha = (o.ombreOpacite * 255).toInt() }
          val decale = Rect(destination).apply { offset(o.ombreDx, o.ombreDy) }
          toile.drawBitmap(silhouette, null, decale, teinte)
          silhouette.recycle()
        }

        toile.drawBitmap(decoupe, source, destination, lisse)
        val fichier = enregistrer(sortie, Bitmap.CompressFormat.JPEG, (o.qualite * 100).toInt(), "jpg")
        sortie.recycle()
        fichier
      } finally {
        decoupe.recycle()
        File(chemin(o.decoupe)).delete()
      }
    }
  }
}
