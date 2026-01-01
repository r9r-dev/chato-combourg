"""
Exceptions centralisées pour l'application.

Ce module définit les exceptions personnalisées utilisées dans l'API.
Chaque exception est convertie en réponse HTTP par le handler global.
"""

from fastapi import HTTPException


class AppException(HTTPException):
    """
    Exception de base pour l'application.

    Toutes les exceptions métier héritent de cette classe.
    Fournit un code d'erreur unique et un message utilisateur.
    """

    status_code: int = 500
    code: str = "INTERNAL_ERROR"
    detail: str = "Une erreur interne est survenue"

    def __init__(self, detail: str | None = None, **kwargs):
        super().__init__(
            status_code=self.status_code,
            detail=detail or self.detail,
            **kwargs
        )
        self.code = self.__class__.code


# =============================================================================
# Erreurs de validation (400)
# =============================================================================


class ValidationError(AppException):
    """Erreur de validation des données entrantes."""

    status_code = 400
    code = "VALIDATION_ERROR"
    detail = "Données invalides"


class InvalidCardError(ValidationError):
    """Carte inconnue dans la requête."""

    code = "INVALID_CARD"

    def __init__(self, card_id: str):
        super().__init__(detail=f"Carte inconnue : {card_id}")


class InvalidCoinsError(ValidationError):
    """Erreur de placement des pièces."""

    code = "INVALID_COINS"


class InvalidImageError(ValidationError):
    """Le fichier n'est pas une image valide."""

    code = "INVALID_IMAGE"
    detail = "Le fichier doit être une image"


class ImageTooLargeError(ValidationError):
    """L'image dépasse la taille maximale."""

    code = "IMAGE_TOO_LARGE"

    def __init__(self, max_size_mb: int):
        super().__init__(detail=f"Image trop volumineuse. Taille max : {max_size_mb} Mo")


class InvalidPlayerCountError(ValidationError):
    """Nombre de joueurs invalide."""

    code = "INVALID_PLAYER_COUNT"

    def __init__(self, min_count: int = 2, max_count: int = 5):
        super().__init__(detail=f"Il faut entre {min_count} et {max_count} joueurs")


class DuplicatePlayerError(ValidationError):
    """Joueur en double dans la partie."""

    code = "DUPLICATE_PLAYER"
    detail = "Un même joueur ne peut pas jouer plusieurs fois"


# =============================================================================
# Erreurs de ressources (404)
# =============================================================================


class NotFoundError(AppException):
    """Ressource non trouvée."""

    status_code = 404
    code = "NOT_FOUND"
    detail = "Ressource introuvable"


class PlayerNotFoundError(NotFoundError):
    """Joueur introuvable."""

    code = "PLAYER_NOT_FOUND"
    detail = "Joueur introuvable"


class GameNotFoundError(NotFoundError):
    """Partie introuvable."""

    code = "GAME_NOT_FOUND"
    detail = "Partie introuvable"


class CaptureNotFoundError(NotFoundError):
    """Capture introuvable."""

    code = "CAPTURE_NOT_FOUND"
    detail = "Capture introuvable"


# =============================================================================
# Erreurs métier (400)
# =============================================================================


class BusinessError(AppException):
    """Erreur de règle métier."""

    status_code = 400
    code = "BUSINESS_ERROR"


class PlayerHasGamesError(BusinessError):
    """Le joueur a des parties enregistrées et ne peut pas être supprimé."""

    code = "PLAYER_HAS_GAMES"

    def __init__(self, games_count: int):
        super().__init__(
            detail=f"Impossible de supprimer ce joueur : {games_count} partie(s) enregistrée(s)"
        )


class InvalidPlayerOwnershipError(BusinessError):
    """Un ou plusieurs joueurs n'appartiennent pas à l'utilisateur."""

    code = "INVALID_PLAYER_OWNERSHIP"

    def __init__(self, invalid_ids: list[int]):
        ids_str = ", ".join(str(id) for id in invalid_ids)
        super().__init__(detail=f"Joueurs invalides ou non autorisés : {ids_str}")


# =============================================================================
# Erreurs d'analyse (400)
# =============================================================================


class AnalysisError(AppException):
    """Erreur lors de l'analyse d'image."""

    status_code = 400
    code = "ANALYSIS_ERROR"
    detail = "Erreur lors de l'analyse de l'image"


class ImageProcessingError(AnalysisError):
    """Impossible de traiter l'image."""

    code = "IMAGE_PROCESSING_ERROR"


class CardDetectionError(AnalysisError):
    """Erreur lors de la détection des cartes."""

    code = "CARD_DETECTION_ERROR"


# =============================================================================
# Erreurs d'authentification (401)
# =============================================================================


class AuthenticationError(AppException):
    """Erreur d'authentification."""

    status_code = 401
    code = "AUTHENTICATION_ERROR"
    detail = "Non authentifié"


class MissingAuthHeaderError(AuthenticationError):
    """Header d'authentification manquant."""

    code = "MISSING_AUTH_HEADER"
    detail = "Non authentifié. Header Remote-User manquant."


# =============================================================================
# Erreurs serveur (500)
# =============================================================================


class ServerError(AppException):
    """Erreur serveur interne."""

    status_code = 500
    code = "SERVER_ERROR"
    detail = "Erreur serveur interne"


class DatabaseError(ServerError):
    """Erreur de base de données."""

    code = "DATABASE_ERROR"
    detail = "Erreur de base de données"
