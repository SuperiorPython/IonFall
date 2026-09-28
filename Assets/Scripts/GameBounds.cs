using UnityEngine;

/// <summary>
/// Defines the world-space Y coordinate representing "ground level" — the line
/// below which enemies shouldn't spawn and the turret shouldn't be able to aim.
/// Drag the GameObject holding this script up/down in the Scene view to
/// reposition the line; the yellow gizmo line updates live for easy tuning.
/// </summary>
public class GameBounds : MonoBehaviour
{
    [Tooltip("World-space Y coordinate below which nothing should spawn or aim.")]
    [SerializeField] private float groundY = 0f;

    public float GroundY => groundY;

    private void OnDrawGizmos()
    {
        Gizmos.color = Color.yellow;
        Vector3 left = new Vector3(-50f, groundY, 0f);
        Vector3 right = new Vector3(50f, groundY, 0f);
        Gizmos.DrawLine(left, right);
    }
}
