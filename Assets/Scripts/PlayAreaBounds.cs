using UnityEngine;

/// <summary>
/// Defines a rectangular world-space play area. Enemies and projectiles that
/// exit this rectangle should despawn — see PlayAreaBounds.IsOutside().
/// Attach to an empty GameObject; the cyan wire cube in the Scene view shows
/// the current bounds so you can size it to match your camera's visible area
/// (with some margin, so enemies retreat fully off-screen before despawning).
/// </summary>
public class PlayAreaBounds : MonoBehaviour
{
    [SerializeField] private float minX = -20f;
    [SerializeField] private float maxX = 20f;
    [SerializeField] private float minY = -12f;
    [SerializeField] private float maxY = 12f;

    public bool IsOutside(Vector2 pos)
    {
        return pos.x < minX || pos.x > maxX || pos.y < minY || pos.y > maxY;
    }

    private void OnDrawGizmos()
    {
        Gizmos.color = Color.cyan;
        Vector3 center = new Vector3((minX + maxX) / 2f, (minY + maxY) / 2f, 0f);
        Vector3 size = new Vector3(maxX - minX, maxY - minY, 0f);
        Gizmos.DrawWireCube(center, size);
    }
}
