using UnityEngine;

/// <summary>
/// Declares how this enemy prefab should be positioned when spawned.
/// Flying enemies use the normal above-ground-line random spawn (unchanged
/// behavior). Ground enemies get clamped exactly onto the ground line, so
/// they visually read as walking along it rather than floating at some
/// arbitrary height above it.
/// </summary>
public enum EnemyMovementType { Flying, Ground }

public class EnemyTypeMarker : MonoBehaviour
{
    public EnemyMovementType movementType = EnemyMovementType.Ground;
}
