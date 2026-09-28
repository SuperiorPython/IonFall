using UnityEngine;

/// <summary>
/// Rotates the turret to face the mouse cursor in world space.
/// Attach this to the turret's rotating part (a child of the Dome, typically),
/// separate from the Dome's own body so DomeHealth doesn't need to know about aiming.
/// </summary>
public class Turret : MonoBehaviour
{
    [Header("Aiming")]
    [SerializeField] private float rotationOffset = -90f; // adjust if your sprite's "forward" isn't pointing up
    [SerializeField] private Camera targetCamera; // leave empty to auto-use Camera.main
    [SerializeField] private GameBounds gameBounds; // optional — leave empty to disable the ground clamp

    // The true direction toward the mouse, BEFORE rotationOffset is applied.
    // TurretShoot should fire using this, not the object's rotated transform —
    // otherwise projectiles inherit the same visual offset and fire off-angle.
    public Vector2 AimDirection { get; private set; } = Vector2.right;

    private void Awake()
    {
        if (targetCamera == null)
        {
            targetCamera = Camera.main;
        }
    }

    private void Update()
    {
        AimAtMouse();
    }

    private void AimAtMouse()
    {
        Vector3 mouseScreenPos = Input.mousePosition;
        mouseScreenPos.z = targetCamera.WorldToScreenPoint(transform.position).z;
        Vector3 mouseWorldPos = targetCamera.ScreenToWorldPoint(mouseScreenPos);

        // Prevent aiming below ground level — clamp before any angle math happens.
        if (gameBounds != null && mouseWorldPos.y < gameBounds.GroundY)
        {
            mouseWorldPos.y = gameBounds.GroundY;
        }

        Vector2 direction = (mouseWorldPos - transform.position);
        AimDirection = direction.normalized;

        float angle = Mathf.Atan2(direction.y, direction.x) * Mathf.Rad2Deg;
        transform.rotation = Quaternion.Euler(0f, 0f, angle + rotationOffset);
    }
}
