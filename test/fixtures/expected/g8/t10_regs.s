	.file	1 "t10_regs.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	pressure
	.align	2
	.globl	spill
	.align	2
	.globl	bigframe

	.text
	.text
	.ent	pressure
pressure:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	mult	$4,$5
	mflo	$4
	#nop
	#nop
	mult	$6,$7
	lw	$2,20($sp)
	mflo	$6
	#nop
	lw	$7,16($sp)
	#nop
	mult	$7,$2
	lw	$3,24($sp)
	mflo	$7
	#nop
	lw	$2,28($sp)
	#nop
	mult	$3,$2
	mflo	$3
	#nop
	addu	$8,$4,$6
	addu	$10,$7,$3
	mult	$8,$10
	mflo	$2
	#nop
	subu	$5,$4,$7
	subu	$9,$6,$3
	mult	$5,$9
	xor	$4,$4,$6
	xor	$4,$4,$7
	xor	$4,$4,$3
	or	$8,$8,$10
	and	$5,$5,$9
	mflo	$12
	#nop
	#nop
	addu	$2,$2,$12
	addu	$2,$2,$4
	addu	$2,$2,$8
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$2,$5
	.set	macro
	.set	reorder

	.end	pressure
	.text
	.ent	spill
spill:
	.frame	$sp,40,$31		# vars= 0, regs= 6/0, args= 16, extra= 0
	.mask	0x801f0000,-4
	.fmask	0x00000000,0
	subu	$sp,$sp,40
	sw	$16,16($sp)
	move	$16,$5
	sw	$17,20($sp)
	move	$17,$6
	sw	$18,24($sp)
	move	$18,$7
	sw	$31,36($sp)
	sw	$20,32($sp)
	.set	noreorder
	.set	nomacro
	jal	ext
	sw	$19,28($sp)
	.set	macro
	.set	reorder

	move	$4,$16
	.set	noreorder
	.set	nomacro
	jal	ext
	move	$20,$2
	.set	macro
	.set	reorder

	move	$4,$17
	.set	noreorder
	.set	nomacro
	jal	ext
	move	$19,$2
	.set	macro
	.set	reorder

	move	$4,$18
	.set	noreorder
	.set	nomacro
	jal	ext
	move	$18,$2
	.set	macro
	.set	reorder

	addu	$4,$20,$19
	.set	noreorder
	.set	nomacro
	jal	ext
	move	$17,$2
	.set	macro
	.set	reorder

	addu	$4,$18,$17
	.set	noreorder
	.set	nomacro
	jal	ext
	move	$16,$2
	.set	macro
	.set	reorder

	mult	$20,$18
	mflo	$9
	#nop
	#nop
	mult	$19,$17
	addu	$16,$16,$2
	lw	$31,36($sp)
	lw	$20,32($sp)
	lw	$18,24($sp)
	addu	$16,$16,$9
	lw	$19,28($sp)
	lw	$17,20($sp)
	mflo	$3
	#nop
	#nop
	addu	$2,$16,$3
	lw	$16,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,40
	.set	macro
	.set	reorder

	.end	spill
	.text
	.ent	bigframe
bigframe:
	.frame	$sp,256,$31		# vars= 256, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	subu	$sp,$sp,256
	li	$5,63			# 0x0000003f
	addu	$3,$sp,252
	sll	$2,$4,6
	subu	$2,$2,$4
$L7:
	sw	$2,0($3)
	addu	$3,$3,-4
	addu	$5,$5,-1
	.set	noreorder
	.set	nomacro
	bgez	$5,$L7
	subu	$2,$2,$4
	.set	macro
	.set	reorder

	andi	$2,$4,0x003f
	sll	$2,$2,2
	addu	$3,$sp,$2
	addu	$2,$4,1
	andi	$2,$2,0x003f
	sll	$2,$2,2
	addu	$2,$sp,$2
	lw	$3,0($3)
	lw	$2,0($2)
	#nop
	addu	$2,$3,$2
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,256
	.set	macro
	.set	reorder

	.end	bigframe
